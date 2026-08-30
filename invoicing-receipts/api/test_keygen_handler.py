"""
Tests for the orchestration layer of api/keygen.py — `generate_and_store_signing_key()` and
its HTTP/Supabase-insert collaborators. The actual network call (`urllib.request.urlopen`) is
mocked (`unittest.mock.patch`) — this is business/validation logic (required-field checks,
error-status mapping, "never leak key material"), not the HTTP transport itself, and does not
need a real network or a real Supabase project to verify.
"""

import base64
import json
from unittest.mock import MagicMock, patch

import pytest

from keygen import KeygenError, generate_and_store_signing_key

VALID_PAYLOAD = {
    "business_id": "11111111-1111-1111-1111-111111111111",
    "legal_name": "Acme Co",
    "tax_id": "123456789",
}


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    # ADR-INV-003 §D4: "KEK = base64(32B)" — not hex.
    monkeypatch.setenv("SIGNING_MASTER_KEK_V1", base64.b64encode(b"\xab" * 32).decode("ascii"))
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")


def _mock_response(status=201):
    response = MagicMock()
    response.status = status
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    return response


@patch("keygen.urllib.request.urlopen")
def test_successful_request_inserts_and_returns_only_non_sensitive_metadata(mock_urlopen):
    mock_urlopen.return_value = _mock_response(201)

    result = generate_and_store_signing_key(VALID_PAYLOAD)

    assert result["business_id"] == VALID_PAYLOAD["business_id"]
    assert "certificate_serial" in result
    assert "not_after" in result
    assert "private_key" not in json.dumps(result)

    # exactly two calls: the business_signing_keys INSERT, then the direct audit_log INSERT.
    assert mock_urlopen.call_count == 2
    insert_request = mock_urlopen.call_args_list[0][0][0]
    assert insert_request.full_url == "https://example.supabase.co/rest/v1/business_signing_keys"
    assert insert_request.get_header("Authorization") == "Bearer test-service-role-key"


@patch("keygen.urllib.request.urlopen")
def test_successful_request_writes_a_key_create_audit_log_row_directly(mock_urlopen):
    """code-quality review (Batch 3, 🔴): business_signing_keys writes were not audited at
    all — CLAUDE.md invariant #2. 0016 first fixed this via a public.log_event() RPC call
    extended to accept service_role; the architect reverted that extension
    (0017_log_event_revert.sql) — service_role already has BYPASSRLS and can INSERT into
    audit_log directly, exactly like public.create_business() already does. This writes that
    row directly instead of calling the RPC."""
    mock_urlopen.return_value = _mock_response(201)

    generate_and_store_signing_key(VALID_PAYLOAD)

    audit_request = mock_urlopen.call_args_list[1][0][0]
    assert audit_request.full_url == "https://example.supabase.co/rest/v1/audit_log"
    assert audit_request.get_header("Authorization") == "Bearer test-service-role-key"

    body = json.loads(audit_request.data)
    assert body["business_id"] == VALID_PAYLOAD["business_id"]
    assert body["actor_type"] == "service"
    assert body["actor_id"] is None
    assert body["action"] == "key_create"
    assert body["table_name"] == "business_signing_keys"
    assert body["record_id"]  # the generated business_signing_keys.id, not null
    assert body["after_data"] == {
        "certificate_serial": body["after_data"]["certificate_serial"],
        "kek_id": body["after_data"]["kek_id"],
    }
    # never the private key / ciphertext — only non-sensitive metadata.
    assert "private_key" not in json.dumps(body)
    assert "ciphertext" not in json.dumps(body)


@patch("keygen.urllib.request.urlopen")
def test_an_audit_log_insert_failure_does_not_fail_the_overall_keygen_request(mock_urlopen):
    """The signing key itself was already durably written — a failure auditing that fact is
    a (loggable server-side) problem, not a reason to report failure for a request that, from
    the caller's point of view, already succeeded."""
    import urllib.error

    mock_urlopen.side_effect = [
        _mock_response(201),  # the business_signing_keys INSERT succeeds
        urllib.error.URLError("connection refused"),  # the audit_log insert fails
    ]

    result = generate_and_store_signing_key(VALID_PAYLOAD)

    assert result["business_id"] == VALID_PAYLOAD["business_id"]
    assert mock_urlopen.call_count == 2


@pytest.mark.parametrize("missing_field", ["business_id", "legal_name", "tax_id"])
def test_rejects_a_payload_missing_a_required_field(missing_field):
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != missing_field}

    with pytest.raises(KeygenError) as exc_info:
        generate_and_store_signing_key(payload)

    assert exc_info.value.status == 400
    assert missing_field in exc_info.value.message


def test_surfaces_a_clear_500_when_the_kek_is_not_configured(monkeypatch):
    monkeypatch.delenv("SIGNING_MASTER_KEK_V1", raising=False)

    with pytest.raises(KeygenError) as exc_info:
        generate_and_store_signing_key(VALID_PAYLOAD)

    assert exc_info.value.status == 500


def test_surfaces_a_clear_500_when_supabase_credentials_are_not_configured(monkeypatch):
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)

    with pytest.raises(KeygenError) as exc_info:
        generate_and_store_signing_key(VALID_PAYLOAD)

    assert exc_info.value.status == 500


@patch("keygen.urllib.request.urlopen")
def test_maps_a_supabase_http_error_to_a_502_without_leaking_the_response_body(mock_urlopen):
    import urllib.error

    mock_urlopen.side_effect = urllib.error.HTTPError(
        url="https://example.supabase.co/rest/v1/business_signing_keys",
        code=409,
        msg="Conflict",
        hdrs=None,
        fp=None,
    )

    with pytest.raises(KeygenError) as exc_info:
        generate_and_store_signing_key(VALID_PAYLOAD)

    assert exc_info.value.status == 502
    assert "409" in exc_info.value.message


@patch("keygen.urllib.request.urlopen")
def test_maps_a_network_error_to_a_502(mock_urlopen):
    import urllib.error

    mock_urlopen.side_effect = urllib.error.URLError("connection refused")

    with pytest.raises(KeygenError) as exc_info:
        generate_and_store_signing_key(VALID_PAYLOAD)

    assert exc_info.value.status == 502
