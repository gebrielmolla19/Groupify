#!/usr/bin/env bash
# Look for secrets in what this branch adds, before it is committed or pushed.
#
#   check-secrets.sh                 lines added since origin/main (committed,
#                                    staged, unstaged and untracked files)
#   check-secrets.sh <base-ref>      same, against another base
#   check-secrets.sh --commit <sha>  lines added by one commit
#   check-secrets.sh --all-files     every line of every tracked and untracked
#                                    file (an audit of the whole tree)
#
# Prints file:line and the kind of secret, never the value. Exits 1 if
# anything is found. Only the matched value is compared with the
# placeholder list, so a real value next to "process.env" or "example"
# on the same line is still caught.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not inside a git repo"; exit 2; }
cd "$ROOT"

BASE="origin/main"; MODE="branch"; COMMIT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --commit) MODE="commit"; COMMIT="$2"; shift 2 ;;
    --all-files) MODE="all"; shift ;;
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

whole_files() { # NUL-separated paths on stdin
  while IFS= read -r -d '' f; do
    [ -f "$f" ] || continue
    grep -Iq . "$f" 2>/dev/null || continue   # skip binary and empty files
    awk -v f="$f" '{ print f "\t" NR "\t" $0 }' "$f"
  done
}

collect() {
  case "$MODE" in
    commit)
      git show --format= --unified=0 --no-color "$COMMIT" | added_lines ;;
    all)
      { git ls-files -z; git ls-files --others --exclude-standard -z; } | whole_files ;;
    branch)
      git rev-parse --verify --quiet "$BASE" >/dev/null || { echo "Unknown base ref: $BASE" >&2; exit 2; }
      { git diff --unified=0 --no-color "$BASE"...HEAD
        git diff --unified=0 --no-color --cached
        git diff --unified=0 --no-color
      } | added_lines
      # Untracked files that would be committed (gitignored ones are skipped).
      git ls-files --others --exclude-standard -z | whole_files ;;
  esac
}

# kind|case|regex. case is "i" for case-insensitive. The regex match is the
# value checked against PLACEHOLDER, so keep it tight around the secret.
SQ="'"
V='[A-Za-z0-9+/_.=-]{16,}'   # a secret-looking value
PATTERNS=(
  "MongoDB URI with a password||mongodb(\+srv)?://[^/[:space:]:@\"$SQ]+:[^@[:space:]\"$SQ]+@"
  "Google API key||AIza[0-9A-Za-z_-]{35}"
  "GitHub token||(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})"
  "Anthropic or OpenAI key||sk-(ant-)?[A-Za-z0-9_-]{32,}"
  "Private key||-----BEGIN [A-Z ]*PRIVATE KEY-----"
  "JWT||eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"
  # KEY=value in env files and shell (unquoted or quoted).
  "Secret assigned a value||(SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|REFRESH_TOKEN)[A-Z0-9_]*[[:space:]]*[=:][[:space:]]*[\"$SQ]?$V"
  # clientSecret: '...', password = \"...\", apiKey: '...' in code and JSON.
  "Secret in code|i|(secret|password|passwd|api_?key|access_?token|refresh_?token)[a-z0-9_]*[\"$SQ]?[[:space:]]*[:=][[:space:]]*[\"$SQ\`]$V"
  # process.env.JWT_SECRET || '...'  /  config.apiKey ?? \"...\"
  "Hard-coded fallback secret|i|(secret|password|passwd|api_?key|token)[a-z0-9_]*[[:space:]]*(\|\||\?\?)[[:space:]]*[\"$SQ\`]$V"
)
# A matched value containing one of these is a placeholder, not a secret.
PLACEHOLDER='your_|your-|<[a-z_ -]+>|example|placeholder|changeme|change-me|username:password|user:pass|test-|-test|_test|dummy|fake|sample|mock|xxx|\$\{|\$\(|redacted'

FOUND=0
T=$'\t'
DATA="$(collect | grep -vE "^[^$T]*(package-lock\.json|\.min\.js|/dev-dist/|/playwright-report/)[^$T]*$T" || true)"
for p in "${PATTERNS[@]}"; do
  kind="${p%%|*}"; rest="${p#*|}"; flags="${rest%%|*}"; re="${rest#*|}"
  gi=""; [ "$flags" = "i" ] && gi="i"
  # Candidate lines first (one grep over everything), then check each match.
  CANDIDATES="$(printf '%s\n' "$DATA" | grep -E$gi -- "^[^$T]*$T[0-9]+$T.*($re)" || true)"
  [ -z "$CANDIDATES" ] && continue
  while IFS=$'\t' read -r file line text; do
    while IFS= read -r m; do
      [ -z "$m" ] && continue
      if ! printf '%s\n' "$m" | grep -Eiq -- "$PLACEHOLDER"; then
        echo "  $file:$line  $kind"; FOUND=1; break
      fi
    done < <(printf '%s\n' "$text" | grep -oE$gi -- "$re" || true)
  done <<< "$CANDIDATES"
done

# Real env files must never be added or renamed in, whatever they contain.
ENV_RE='(^|/)\.env(\.[^/]*)?$'
case "$MODE" in
  commit) ENV_FILES="$(git show --name-only --format= --diff-filter=AR "$COMMIT")" ;;
  all) ENV_FILES="$(git ls-files)" ;;
  branch) ENV_FILES="$( { git diff --name-only --diff-filter=AR "$BASE"...HEAD
                          git diff --name-only --cached --diff-filter=AR
                          git ls-files --others --exclude-standard; } )" ;;
esac
ENV_FILES="$(printf '%s\n' "$ENV_FILES" | grep -E "$ENV_RE" | grep -vE '\.env\.example$' | sort -u || true)"
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
