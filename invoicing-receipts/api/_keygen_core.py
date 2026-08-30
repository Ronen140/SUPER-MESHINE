"""
Pure key-generation / envelope-encryption logic for B9 (ADR-INV-003 §D4). No HTTP, no
network, no Supabase client — `api/keygen.py` (the actual Vercel serverless function) is a
thin wrapper around `create_signing_key_record()` that reads `SIGNING_MASTER_KEK_V1` from the
environment, calls this module, and POSTs the resulting record to
`{SUPABASE_URL}/rest/v1/business_signing_keys` using the `service_role` key — the only role
`business_signing_keys` (FORCE + zero policies, ADR-INV-001 §D3.2) ever accepts writes from.

Envelope encryption layout (ADR-INV-003 §D4):
    DEK  = random 32 bytes
    private_key_ciphertext = AES-256-GCM(DEK, private_key_nonce, PKCS8-DER(private_key))
    wrapped_dek             = private_key's-own-fresh-nonce(12B) || AES-256-GCM(KEK, that-nonce, DEK)
    KEK                     = 32 raw bytes, hex-encoded in the `SIGNING_MASTER_KEK_V1` env var

Judgment call, flagged for architect review (ADR-INV-001's `business_signing_keys` schema has
exactly one nonce column, `private_key_nonce` — not one per AES-GCM operation): rather than
reusing one nonce across two different keys (safe in principle — AES-GCM's uniqueness
requirement is per-*key*, and DEK/KEK are different keys — but a subtler invariant to keep
correct under any future refactor), `wrapped_dek`'s own fresh 12-byte nonce is prepended to
its ciphertext and stored as a single blob, while `private_key_nonce` is a plain, separate,
explicit column for the private-key encryption's own independently-random nonce. Both
operations therefore get a fresh, independent nonce, and the schema's four columns are used
exactly as named without repurposing any of them.
"""

from __future__ import annotations

import dataclasses
import datetime
import hashlib
import os

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

# ADR-INV-003 §D4: "ExtendedKeyUsage: id-kp-documentSigning (1.3.6.1.5.5.7.3.36)". Not one of
# cryptography's built-in ExtendedKeyUsageOID constants (as of this writing) — defined here by
# dotted string, verbatim from the ADR.
DOCUMENT_SIGNING_OID = x509.ObjectIdentifier("1.3.6.1.5.5.7.3.36")

_CERTIFICATE_VALIDITY = datetime.timedelta(days=3652)  # 10 years, including leap days
_RSA_KEY_SIZE = 3072
_RSA_PUBLIC_EXPONENT = 65537
_AES_KEY_SIZE_BYTES = 32
_AES_GCM_NONCE_SIZE_BYTES = 12


def generate_rsa_keypair() -> rsa.RSAPrivateKey:
    """RSA-3072 (ADR-INV-003 §D4: not ECDSA for wider PDF-reader compatibility, not RSA-2048
    given a 10+ year certificate lifetime)."""
    return rsa.generate_private_key(public_exponent=_RSA_PUBLIC_EXPONENT, key_size=_RSA_KEY_SIZE)


def build_self_signed_certificate(
    private_key: rsa.RSAPrivateKey, *, legal_name: str, tax_id: str
) -> x509.Certificate:
    """X.509 v3 self-issued certificate, exactly per ADR-INV-003 §D4:
    CN={legal_name}, serialNumber={tax_id}, O={legal_name}, C=IL; notAfter = now + 10y;
    BasicConstraints CA:FALSE; KeyUsage digitalSignature + contentCommitment (nonRepudiation);
    ExtendedKeyUsage id-kp-documentSigning."""
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, legal_name),
            x509.NameAttribute(NameOID.SERIAL_NUMBER, tax_id),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, legal_name),
            x509.NameAttribute(NameOID.COUNTRY_NAME, "IL"),
        ]
    )

    not_before = datetime.datetime.now(datetime.timezone.utc)
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(not_before)
        .not_valid_after(not_before + _CERTIFICATE_VALIDITY)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=True,  # a.k.a. non-repudiation
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([DOCUMENT_SIGNING_OID]),
            critical=False,
        )
    )
    return builder.sign(private_key, hashes.SHA256())


@dataclasses.dataclass(frozen=True)
class SigningKeyEnvelope:
    private_key_ciphertext: bytes
    private_key_nonce: bytes
    wrapped_dek: bytes


def envelope_encrypt_private_key(private_key_der: bytes, *, kek: bytes) -> SigningKeyEnvelope:
    """Encrypts `private_key_der` (PKCS8 DER) under a fresh random DEK, then wraps that DEK
    under `kek`. Every AES-GCM operation gets its own independently-random nonce (see this
    module's header comment for why)."""
    dek = os.urandom(_AES_KEY_SIZE_BYTES)

    private_key_nonce = os.urandom(_AES_GCM_NONCE_SIZE_BYTES)
    private_key_ciphertext = AESGCM(dek).encrypt(private_key_nonce, private_key_der, None)

    wrap_nonce = os.urandom(_AES_GCM_NONCE_SIZE_BYTES)
    wrapped_dek = wrap_nonce + AESGCM(kek).encrypt(wrap_nonce, dek, None)

    return SigningKeyEnvelope(
        private_key_ciphertext=private_key_ciphertext,
        private_key_nonce=private_key_nonce,
        wrapped_dek=wrapped_dek,
    )


def envelope_decrypt_private_key(envelope: SigningKeyEnvelope, *, kek: bytes) -> bytes:
    """Inverse of `envelope_encrypt_private_key` — used by `api/sign.py` (ADR-INV-003 §D2,
    out of this batch's scope), and by this module's own round-trip test."""
    wrap_nonce, wrapped_dek_ciphertext = (
        envelope.wrapped_dek[:_AES_GCM_NONCE_SIZE_BYTES],
        envelope.wrapped_dek[_AES_GCM_NONCE_SIZE_BYTES:],
    )
    dek = AESGCM(kek).decrypt(wrap_nonce, wrapped_dek_ciphertext, None)
    return AESGCM(dek).decrypt(envelope.private_key_nonce, envelope.private_key_ciphertext, None)


def kek_from_env() -> tuple[bytes, str]:
    """Reads the KEK from `SIGNING_MASTER_KEK_V1` (ADR-INV-003 §D4 — 32 raw bytes, hex-encoded
    in the env var; Vercel Environment Variables, marked Sensitive, never in Supabase). The
    env var's own name doubles as `kek_id` so a future rotation (`SIGNING_MASTER_KEK_V2`)
    only requires adding a new env var and reading it as of the next key generated — every
    existing row keeps working via its own recorded `kek_id`."""
    env_name = "SIGNING_MASTER_KEK_V1"
    raw = os.environ.get(env_name)
    if not raw:
        raise RuntimeError(f"{env_name} is not set — cannot generate a signing key")
    kek = bytes.fromhex(raw)
    if len(kek) != _AES_KEY_SIZE_BYTES:
        raise RuntimeError(f"{env_name} must decode to exactly {_AES_KEY_SIZE_BYTES} bytes")
    return kek, env_name


def create_signing_key_record(
    *, business_id: str, legal_name: str, tax_id: str, kek: bytes, kek_id: str
) -> dict:
    """Builds the full row to INSERT into `public.business_signing_keys` (ADR-INV-001
    schema) — generates the keypair, builds and self-signs the certificate, envelope-encrypts
    the private key, and returns exactly the columns that table has. Never returns (or logs,
    or holds onto past its own stack frame any longer than necessary) the raw private key —
    only its ciphertext."""
    private_key = generate_rsa_keypair()
    certificate = build_self_signed_certificate(private_key, legal_name=legal_name, tax_id=tax_id)

    private_key_der = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    envelope = envelope_encrypt_private_key(private_key_der, kek=kek)

    certificate_pem = certificate.public_bytes(serialization.Encoding.PEM).decode("ascii")
    certificate_der = certificate.public_bytes(serialization.Encoding.DER)
    fingerprint_sha256 = hashlib.sha256(certificate_der).digest()

    return {
        "business_id": business_id,
        "algorithm": "RSA-3072",
        "certificate_pem": certificate_pem,
        "certificate_serial": format(certificate.serial_number, "x"),
        "subject_dn": certificate.subject.rfc4514_string(),
        "fingerprint_sha256": fingerprint_sha256,
        "not_before": certificate.not_valid_before_utc.isoformat(),
        "not_after": certificate.not_valid_after_utc.isoformat(),
        "private_key_ciphertext": envelope.private_key_ciphertext,
        "private_key_nonce": envelope.private_key_nonce,
        "wrapped_dek": envelope.wrapped_dek,
        "kek_id": kek_id,
        "is_active": True,
    }
