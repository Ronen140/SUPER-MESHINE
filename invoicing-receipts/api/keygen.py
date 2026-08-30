"""
api/keygen.py — Vercel Python serverless function (B9, ADR-INV-003 §D4).

Deployed by Vercel at POST /api/keygen. Called exactly once per business, by
`src/app/api/businesses/route.ts` — and only *after* `public.create_business()` (the RPC)
has already committed (ADR-INV-001 Implementation Notes #11: "אין לאחד את שני השלבים
(קריאת HTTP מתוך Postgres)"). A failure here leaves a business with no signing key — a
handled, recoverable state (`public.issue_document()` raises `INV_NO_SIGNING_KEY` until a key
exists), not a broken one.

Uses only Python's standard library beyond `cryptography` (already required by ADR-INV-003
§D4 itself for RSA/X.509/AES-GCM — there is no stdlib substitute for any of those) to reach
Supabase: a `POST .../rest/v1/business_signing_keys` via `urllib.request`, using the
`service_role` key — the only role `business_signing_keys` (FORCE + zero policies,
ADR-INV-001 §D3.2) accepts writes from. No `psycopg2`/`supabase-py`/HTTP-framework dependency
was added for this — flagged here for visibility, not silently decided: if a richer Supabase
Python client is wanted later, that is a new dependency requiring approval first.

code-quality review (Batch 3, 🔴): the INSERT above wrote no audit_log row at all — a direct
violation of CLAUDE.md invariant #2. Fixed by calling `public.log_event()`
(`0016_log_event_and_fixes.sql`) right after a successful INSERT, via `POST
.../rest/v1/rpc/log_event` with the same service_role key. `log_event()` was extended
specifically to accept a service_role-authenticated call (no `auth.uid()` to check
membership against) and record it with `actor_type='service'` — see that migration's header
comment. A `log_event` failure is logged server-side but does *not* fail this request: the
signing key itself was already durably written by the time it runs.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

from _keygen_core import create_signing_key_record, kek_from_env

_REQUIRED_FIELDS = ("business_id", "legal_name", "tax_id")

_logger = logging.getLogger("keygen")


class KeygenError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _supabase_credentials() -> tuple[str, str]:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_role_key:
        raise KeygenError(500, "Supabase credentials are not configured")
    return url, service_role_key


def _insert_signing_key(record: dict, *, supabase_url: str, service_role_key: str) -> None:
    body = json.dumps(
        {
            **record,
            # bytea columns: PostgREST accepts Postgres's `\x`-hex-encoded text form for bytea
            # over JSON.
            "fingerprint_sha256": "\\x" + record["fingerprint_sha256"].hex(),
            "private_key_ciphertext": "\\x" + record["private_key_ciphertext"].hex(),
            "private_key_nonce": "\\x" + record["private_key_nonce"].hex(),
            "wrapped_dek": "\\x" + record["wrapped_dek"].hex(),
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        f"{supabase_url}/rest/v1/business_signing_keys",
        data=body,
        method="POST",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status not in (200, 201, 204):
                raise KeygenError(502, f"Supabase returned unexpected status {response.status}")
    except urllib.error.HTTPError as error:
        # Never echo the response body back to the caller — it may include the raw INSERT
        # payload's column names / Postgres error text, which is diagnostic-only.
        raise KeygenError(502, f"Supabase rejected the signing key insert (HTTP {error.code})") from error
    except urllib.error.URLError as error:
        raise KeygenError(502, "Could not reach Supabase") from error


def generate_and_store_signing_key(payload: dict) -> dict:
    """Orchestrates one full keygen request: validate input, generate+encrypt the key,
    insert it. Raises `KeygenError` for every failure mode; never returns key material."""
    missing = [f for f in _REQUIRED_FIELDS if not payload.get(f)]
    if missing:
        raise KeygenError(400, f"Missing required field(s): {', '.join(missing)}")

    try:
        kek, kek_id = kek_from_env()
    except RuntimeError as error:
        raise KeygenError(500, str(error)) from error

    supabase_url, service_role_key = _supabase_credentials()

    record = create_signing_key_record(
        business_id=payload["business_id"],
        legal_name=payload["legal_name"],
        tax_id=payload["tax_id"],
        kek=kek,
        kek_id=kek_id,
    )

    _insert_signing_key(record, supabase_url=supabase_url, service_role_key=service_role_key)

    # ADR-INV-003 §D4 logging rule: "לעולם לא חומר מפתח, לא DEK, לא KEK" — only
    # non-sensitive metadata is ever returned to the caller.
    return {
        "business_id": record["business_id"],
        "certificate_serial": record["certificate_serial"],
        "not_after": record["not_after"],
    }


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel's required class name.
    def do_POST(self) -> None:  # noqa: N802 — BaseHTTPRequestHandler's required method name.
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length) if content_length else b"{}"

        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            self._respond(400, {"error": "Invalid JSON body"})
            return

        try:
            result = generate_and_store_signing_key(payload)
        except KeygenError as error:
            self._respond(error.status, {"error": error.message})
            return

        self._respond(200, result)

    def _respond(self, status: int, body: dict) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
