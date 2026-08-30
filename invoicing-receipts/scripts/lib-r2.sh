#!/usr/bin/env bash
# scripts/lib-r2.sh — B14. Shared Cloudflare R2 (S3-compatible) helpers for
# scripts/backup-to-r2.sh and scripts/restore-test.sh. Not a standalone script — `source`
# it after R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET are set in the
# environment (see docs/ops-runbook.md for how the founder creates these).
#
# Uses the `aws` CLI against R2's S3-compatible endpoint rather than hand-rolling AWS
# SigV4 request signing in bash. GitHub's `ubuntu-latest` runner image ships AWS CLI v2
# pre-installed (documented in the runner image's software manifest) — the same class of
# assumption this project already makes for `psql` in `.github/workflows/ci.yml`.
# `r2::ensure_cli` below is a defensive fallback (pip install) for the case that assumption
# ever stops holding, mirroring ci.yml's "Ensure psql is available" step exactly.
#
# ADR-INV-003 §D5 calls this "עותק חוץ עצמאי" — chose R2 over Backblaze B2 (both offered as
# equally acceptable in the ADR) as a prior backend-builder-level call (see
# vault/Engineering/invoicing-phase-0-plan.md Open Question #5); nothing here is
# R2-specific beyond the endpoint URL shape, so swapping to B2 later is a one-line change.

r2::ensure_cli() {
  if command -v aws >/dev/null 2>&1; then
    return 0
  fi
  echo "==> aws CLI not found on PATH, installing via pip (fallback path — see lib-r2.sh header)" >&2
  pip3 install --quiet --user awscli
  export PATH="$HOME/.local/bin:$PATH"
}

r2::endpoint() {
  echo "${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
}

# Runs `aws s3 <args...>` against the R2 endpoint with R2 credentials specifically —
# regardless of whatever AWS_* variables happen to already be set in the calling
# environment (this project's own CI never sets real AWS creds, but this defends against
# accidental collisions in a founder's local shell that also uses AWS elsewhere).
r2::aws() {
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION="auto" \
    aws --endpoint-url "$(r2::endpoint)" "$@"
}

r2::put() { # r2::put <local-file> <key>
  r2::aws s3 cp "$1" "s3://${R2_BUCKET}/$2"
}

r2::get() { # r2::get <key> <local-file>
  r2::aws s3 cp "s3://${R2_BUCKET}/$1" "$2"
}

# Lists object filenames (not the full key — the prefix is stripped, matching `aws s3 ls`'s
# own behavior when given a full s3://bucket/prefix/ path) under s3://$R2_BUCKET/<prefix>/,
# one per line, sorted ascending (oldest-first for our date-named files, since ISO-8601
# names sort lexically the same as chronologically). Parses `aws s3 ls`'s plain-text table
# output (columns: date, time, size, filename) rather than
# `s3api list-objects-v2 --output text`, whose column layout for list-valued JMESPath
# queries is less predictable across AWS CLI versions.
r2::list_filenames() { # r2::list_filenames <prefix>
  r2::aws s3 ls "s3://${R2_BUCKET}/$1/" 2>/dev/null | awk '{print $4}' | grep -v '^$' | sort
}

r2::rm() { # r2::rm <key>
  r2::aws s3 rm "s3://${R2_BUCKET}/$1"
}
