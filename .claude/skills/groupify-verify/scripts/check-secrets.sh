#!/usr/bin/env bash
# Look for secrets in what this branch adds, before it is committed or pushed.
#
#   check-secrets.sh                 lines added since origin/main (committed,
#                                    staged, unstaged and untracked files)
#   check-secrets.sh <base-ref>      same, against another base
#   check-secrets.sh --commit <sha>  lines added by one commit (for testing)
#
# Prints file:line and the kind of secret, never the value. Exits 1 if
# anything is found. Placeholders ("your_...", "example", "test-...") pass.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not inside a git repo"; exit 2; }
cd "$ROOT"

BASE="origin/main"; COMMIT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --commit) COMMIT="$2"; shift 2 ;;
    *) BASE="$1"; shift ;;
  esac
done

# Added lines as "file<TAB>line<TAB>text", from a unified diff on stdin.
added_lines() {
  awk '
    /^\+\+\+ / { f = substr($0, 7); next }
    /^@@ / { split($3, a, ","); n = substr(a[1], 2) + 0; next }
    /^\+/ { print f "\t" n "\t" substr($0, 2); n++; next }
    /^ / { n++ }
  '
}

collect() {
  if [ -n "$COMMIT" ]; then
    git show --format= --unified=0 --no-color "$COMMIT" | added_lines
    return
  fi
  git rev-parse --verify --quiet "$BASE" >/dev/null || { echo "Unknown base ref: $BASE" >&2; exit 2; }
  { git diff --unified=0 --no-color "$BASE"...HEAD
    git diff --unified=0 --no-color --cached
    git diff --unified=0 --no-color
  } | added_lines
  # Untracked files that would be committed (gitignored ones are skipped).
  git ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
    grep -Iq . "$f" 2>/dev/null || continue   # skip binary and empty files
    awk -v f="$f" '{ print f "\t" NR "\t" $0 }' "$f"
  done
}

# kind|regex (extended). Matched case-sensitively unless noted.
PATTERNS=(
  'MongoDB URI with a password|mongodb(\+srv)?://[^/[:space:]:@]+:[^@[:space:]]+@'
  'Google API key|AIza[0-9A-Za-z_-]{35}'
  'GitHub token|(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})'
  'Anthropic or OpenAI key|sk-(ant-)?[A-Za-z0-9_-]{32,}'
  'Private key|-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'JWT|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  'Secret assigned a value|(SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|REFRESH_TOKEN)[A-Z0-9_]*[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9+/_.-]{16,}'
)
# A match is ignored when the line also contains one of these.
PLACEHOLDER='your_|your-|<[a-z_ -]+>|example|placeholder|changeme|username:password|user:pass|test-|-test|dummy|fake|sample|xxx|\$\{|process\.env|localhost'

FOUND=0
T=$'\t'
DATA="$(collect | grep -vE "^[^$T]*(package-lock\.json|\.min\.js|/dev-dist/|/playwright-report/)[^$T]*$T" || true)"
# One grep per pattern over all added lines: match the text column, drop
# placeholders, then print only file:line (never the value).
for p in "${PATTERNS[@]}"; do
  kind="${p%%|*}"; re="${p#*|}"
  HITS="$(printf '%s\n' "$DATA" \
    | grep -E -- "^[^$T]*$T[0-9]+$T.*($re)" \
    | grep -Eiv -- "^[^$T]*$T[0-9]+$T.*($PLACEHOLDER)" \
    | awk -F'\t' -v k="$kind" '{ print "  " $1 ":" $2 "  " k }' || true)"
  if [ -n "$HITS" ]; then printf '%s\n' "$HITS"; FOUND=1; fi
done

# Real env files must never be added, whatever they contain.
if [ -z "$COMMIT" ]; then
  ENV_FILES="$( { git diff --name-only --diff-filter=A "$BASE"...HEAD; git diff --name-only --cached --diff-filter=A; git ls-files --others --exclude-standard; } \
    | grep -E '(^|/)\.env(\.[^/]*)?$' | grep -vE '\.env\.example$' | sort -u || true)"
else
  ENV_FILES="$(git show --name-only --format= --diff-filter=A "$COMMIT" | grep -E '(^|/)\.env(\.[^/]*)?$' | grep -vE '\.env\.example$' || true)"
fi
if [ -n "$ENV_FILES" ]; then
  printf '  %s  env file (must stay untracked)\n' $ENV_FILES
  FOUND=1
fi

if [ "$FOUND" = 1 ]; then
  echo "  Remove the value (use a placeholder in .env.example) before committing."
  echo "  If a real secret was already pushed, rotate it: removing it from git is not enough."
  exit 1
fi
exit 0
