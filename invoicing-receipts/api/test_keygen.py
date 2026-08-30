"""
Tests for api/_keygen_core.py — B9 (ADR-INV-003 §D4). Pure crypto/orchestration logic only
(no HTTP, no network, no real Supabase): the Vercel handler in api/keygen.py is a thin
wrapper around these functions. KEK is always an explicit, injected test value here — never
read from an environment variable in this file (that env-var read is tested separately, once,
in test_reads_kek_from_env, and is the *only* place this file touches os.environ).
"""

import datetime

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from _keygen_core import (
    DOCUMENT_SIGNING_OID,
    build_self_signed_certificate,
    create_signing_key_record,
    envelope_decrypt_private_key,
    envelope_encrypt_private_key,
    generate_rsa_keypair,
    kek_from_env,
)

TEST_KEK = b"\x01" * 32  # 32 random-looking bytes; never a real secret, test-only.


def test_generates_an_rsa_3072_keypair():
    private_key = generate_rsa_keypair()
    assert isinstance(private_key, rsa.RSAPrivateKey)
    assert private_key.key_size == 3072


def test_certificate_has_the_adr_mandated_fields():
    private_key = generate_rsa_keypair()
    cert = build_self_signed_certificate(private_key, legal_name="Acme Co", tax_id="123456789")

    subject = cert.subject
    assert subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value == "Acme Co"
    assert subject.get_attributes_for_oid(NameOID.SERIAL_NUMBER)[0].value == "123456789"
    assert subject.get_attributes_for_oid(NameOID.ORGANIZATION_NAME)[0].value == "Acme Co"
    assert subject.get_attributes_for_oid(NameOID.COUNTRY_NAME)[0].value == "IL"

    # self-issued: issuer == subject
    assert cert.issuer == cert.subject

    basic_constraints = cert.extensions.get_extension_for_class(x509.BasicConstraints).value
    assert basic_constraints.ca is False

    key_usage = cert.extensions.get_extension_for_class(x509.KeyUsage).value
    assert key_usage.digital_signature is True
    assert key_usage.content_commitment is True

    eku = cert.extensions.get_extension_for_class(x509.ExtendedKeyUsage).value
    assert DOCUMENT_SIGNING_OID in eku
    assert str(DOCUMENT_SIGNING_OID.dotted_string) == "1.3.6.1.5.5.7.3.36"

    validity_days = (cert.not_valid_after_utc - cert.not_valid_before_utc).days
    assert 3649 <= validity_days <= 3653  # ~10 years, tolerating leap days

    # the certificate's embedded public key must match the private key it was issued for.
    assert cert.public_key().public_numbers() == private_key.public_key().public_numbers()


def test_certificate_not_before_is_not_in_the_future():
    private_key = generate_rsa_keypair()
    cert = build_self_signed_certificate(private_key, legal_name="Acme Co", tax_id="123456789")
    assert cert.not_valid_before_utc <= datetime.datetime.now(datetime.timezone.utc)


def test_envelope_encrypt_then_decrypt_recovers_the_original_private_key_bytes():
    private_key = generate_rsa_keypair()
    private_key_der = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    envelope = envelope_encrypt_private_key(private_key_der, kek=TEST_KEK)

    assert envelope.private_key_ciphertext != private_key_der
    assert envelope.wrapped_dek != b""
    assert isinstance(envelope.private_key_nonce, bytes)
    assert len(envelope.private_key_nonce) == 12  # AES-GCM standard nonce length

    recovered = envelope_decrypt_private_key(envelope, kek=TEST_KEK)
    assert recovered == private_key_der


def test_envelope_decrypt_fails_with_the_wrong_kek():
    private_key_der = b"not-a-real-key-just-some-bytes-to-envelope"
    envelope = envelope_encrypt_private_key(private_key_der, kek=TEST_KEK)

    wrong_kek = b"\x02" * 32
    with pytest.raises(Exception):  # cryptography raises InvalidTag
        envelope_decrypt_private_key(envelope, kek=wrong_kek)


def test_envelope_encrypt_uses_a_fresh_nonce_every_call():
    private_key_der = b"some bytes to envelope, twice"
    first = envelope_encrypt_private_key(private_key_der, kek=TEST_KEK)
    second = envelope_encrypt_private_key(private_key_der, kek=TEST_KEK)
    assert first.private_key_nonce != second.private_key_nonce
    assert first.wrapped_dek != second.wrapped_dek


def test_create_signing_key_record_never_includes_the_raw_private_key():
    record = create_signing_key_record(
        business_id="11111111-1111-1111-1111-111111111111",
        legal_name="Acme Co",
        tax_id="123456789",
        kek=TEST_KEK,
        kek_id="test-v1",
    )

    assert record["business_id"] == "11111111-1111-1111-1111-111111111111"
    assert record["kek_id"] == "test-v1"
    assert record["algorithm"] == "RSA-3072"
    assert "BEGIN CERTIFICATE" in record["certificate_pem"]
    assert record["is_active"] is True

    serialized = str(record)
    assert "PRIVATE KEY" not in serialized  # the PEM/DER of the private key is never present
    assert "BEGIN RSA PRIVATE" not in serialized


def test_create_signing_key_record_includes_a_generated_id():
    """0017_log_event_revert.sql: api/keygen.py now inserts the audit_log row for a
    'key_create' event directly (as service_role) instead of calling public.log_event() —
    it needs the row's own id up front (before the INSERT response is parsed) to use as
    audit_log.record_id. Generated client-side rather than round-tripping the INSERT
    response, so it is deterministic and available before any network call is made."""
    import uuid

    record = create_signing_key_record(
        business_id="11111111-1111-1111-1111-111111111111",
        legal_name="Acme Co",
        tax_id="123456789",
        kek=TEST_KEK,
        kek_id="test-v1",
    )
    assert uuid.UUID(record["id"]).version == 4


def test_create_signing_key_record_certificate_serial_and_fingerprint_are_populated():
    record = create_signing_key_record(
        business_id="11111111-1111-1111-1111-111111111111",
        legal_name="Acme Co",
        tax_id="123456789",
        kek=TEST_KEK,
        kek_id="test-v1",
    )
    assert record["certificate_serial"]
    assert len(record["fingerprint_sha256"]) == 32  # raw sha256 digest, 32 bytes


def test_reads_kek_from_env_as_base64(monkeypatch):
    """ADR-INV-003 §D4: "KEK = base64(32B) ב-Vercel env var" — not hex."""
    import base64

    monkeypatch.setenv("SIGNING_MASTER_KEK_V1", base64.b64encode(TEST_KEK).decode("ascii"))
    kek, kek_id = kek_from_env()
    assert kek == TEST_KEK
    assert kek_id == "SIGNING_MASTER_KEK_V1"


def test_kek_from_env_raises_a_clear_error_when_unset(monkeypatch):
    monkeypatch.delenv("SIGNING_MASTER_KEK_V1", raising=False)
    with pytest.raises(RuntimeError, match="SIGNING_MASTER_KEK_V1"):
        kek_from_env()


def test_kek_from_env_raises_a_clear_error_for_invalid_base64(monkeypatch):
    monkeypatch.setenv("SIGNING_MASTER_KEK_V1", "not valid base64!!")
    with pytest.raises(RuntimeError, match="SIGNING_MASTER_KEK_V1"):
        kek_from_env()
