#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  printf "Supabase personal access token: " > /dev/tty
  IFS= read -r -s SUPABASE_ACCESS_TOKEN < /dev/tty
  printf "\n" > /dev/tty
fi

if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  echo "Token mancante." >&2
  exit 1
fi

export SUPABASE_ACCESS_TOKEN
node scripts/fetch-supabase-logs.mjs
unset SUPABASE_ACCESS_TOKEN
