#!/usr/bin/env bash
# Self-test for check-secrets.sh: plants generated secrets and placeholders
# in a throwaway repo and checks which lines are flagged.
#
#   bash .claude/skills/groupify-verify/scripts/check-secrets.test.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-secrets.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP" && git init -q && git -c user.name=t -c user.email=t@t commit -q --allow-empty -m base
BASE="$(git rev-parse HEAD)"
h() { openssl rand -hex 16; }

# Each line in leak.txt must be flagged; nothing in ok.txt may be.
{
  echo "const s = process.env.JWT_SECRET || '$(h)';"
  echo "const u = process.env.MONGO_URI || 'mongodb+srv://admin:$(h)@cluster0.ab1cd.mongodb.net/groupify';"
  echo "MONGO_URI=mongodb+srv://admin:$(h)@cluster0.ab1cd.mongodb.net/groupify-test"
  echo "SPOTIFY_CLIENT_SECRET=$(h)  # from the dashboard, see example above"
  echo "const cfg = { clientSecret: '$(h)' };"
  echo "GEMINI_API_KEY=$(h)"
} > leak.txt
cat > ok.txt <<'EOF'
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/groupify
MONGO_URI=mongodb://localhost:27017/groupify-test
JWT_SECRET=test-jwt-secret
const s = process.env.JWT_SECRET;
const t = process.env.JWT_SECRET || 'change-me-in-production';
const token = localStorage.getItem('groupify_token');
password: 'mock-password-value-123'
EOF

OUT="$(bash "$SCRIPT" "$BASE")"
FAIL=0
EXPECTED="$(wc -l < leak.txt | tr -d ' ')"
for n in $(seq 1 "$EXPECTED"); do
  printf '%s\n' "$OUT" | grep -q "leak.txt:$n " || { echo "MISSED leak.txt:$n"; FAIL=1; }
done
if printf '%s\n' "$OUT" | grep -q "ok.txt:"; then
  echo "FALSE POSITIVE:"; printf '%s\n' "$OUT" | grep "ok.txt:"; FAIL=1
fi
# The value must never be printed.
if printf '%s\n' "$OUT" | grep -qE '[0-9a-f]{32}'; then echo "PRINTED A VALUE"; FAIL=1; fi

# A new .env file is flagged; .env.example is not.
echo "X=1" > .env; echo "X=your_x" > .env.example
ENV_OUT="$(bash "$SCRIPT" "$BASE")"   # exits 1 by design; check its output
printf '%s\n' "$ENV_OUT" | grep -q "^  \.env  env file" || { echo "MISSED new .env"; FAIL=1; }
printf '%s\n' "$ENV_OUT" | grep -q "\.env\.example  env file" && { echo "FLAGGED .env.example"; FAIL=1; }

[ "$FAIL" = 0 ] && echo "check-secrets self-test: pass ($EXPECTED leaks caught, placeholders ignored)"
exit "$FAIL"
