#!/usr/bin/env bash
set -euo pipefail

# idempotent mission setup
if [ -f "package.json" ]; then
  if command -v bun >/dev/null 2>&1; then
    PUPPETEER_SKIP_DOWNLOAD=true bun install || true
  fi
fi
