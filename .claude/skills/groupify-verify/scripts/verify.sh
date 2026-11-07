#!/usr/bin/env bash
# Groupify Definition-of-Done checks for the apps the current branch touches.
#
#   verify.sh             compare against origin/main
#   verify.sh <base-ref>  compare against another base (stacked branches)
#   verify.sh --all       check both apps regardless of what changed
#
# Exits non-zero if any check fails.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not inside a git repo"; exit 2; }
cd "$ROOT"

BASE="origin/main"
FORCE_ALL=0
for arg in "$@"; do
  case "$arg" in
    --all) FORCE_ALL=1 ;;
    *) BASE="$arg" ;;
  esac
done

git rev-parse --verify --quiet "$BASE" >/dev/null || { echo "Unknown base ref: $BASE (try: git fetch origin)"; exit 2; }

CHANGED="$( {
  git diff --name-only "$BASE"...HEAD
  git diff --name-only
  git diff --name-only --cached
  git ls-files --others --exclude-standard
} | grep -v '/node_modules$' | sort -u )"

has_changes() { printf '%s\n' "$CHANGED" | grep -q "^$1/"; }

RUN_BACKEND=0; RUN_FRONTEND=0
if [ "$FORCE_ALL" = 1 ]; then RUN_BACKEND=1; RUN_FRONTEND=1; fi
has_changes Groupify-backend && RUN_BACKEND=1
has_changes Groupify-frontend && RUN_FRONTEND=1

echo "Base: $BASE"
echo "Changed files: $(printf '%s\n' "$CHANGED" | grep -c . || true)"
if [ "$RUN_BACKEND" = 0 ] && [ "$RUN_FRONTEND" = 0 ]; then
  echo "No app code changed (use --all to check anyway)."
  exit 0
fi

RESULTS=()
FAILED=0
LOG_DIR="$(mktemp -d)"

run_step() { # name dir command...
  local name="$1" dir="$2"; shift 2
  local log="$LOG_DIR/$(echo "$name" | tr ' /' '__').log"
  printf '▶ %-32s' "$name"
  if (cd "$dir" && "$@") >"$log" 2>&1; then
    echo "pass"; RESULTS+=("PASS  $name")
  else
    echo "FAIL"; RESULTS+=("FAIL  $name  (log: $log)"); FAILED=1
    tail -25 "$log" | sed 's/^/    /'
  fi
}

need_modules() { # dir install-cmd
  if [ ! -e "$1/node_modules" ]; then
    echo "✗ $1/node_modules missing. Run: (cd $1 && $2)"
    FAILED=1; RESULTS+=("FAIL  $1 dependencies not installed"); return 1
  fi
}

if [ "$RUN_BACKEND" = 1 ]; then
  echo; echo "── Backend ──"
  if need_modules Groupify-backend "npm ci"; then
    run_step "backend lint" Groupify-backend npx eslint . --quiet
    # Same placeholder env as CI, so tests don't depend on a local .env.
    run_step "backend tests" Groupify-backend env \
      NODE_ENV=test JWT_SECRET=test-jwt-secret MONGO_URI=mongodb://localhost:27017/groupify-test \
      SPOTIFY_CLIENT_ID=test-client-id SPOTIFY_CLIENT_SECRET=test-client-secret \
      SPOTIFY_REDIRECT_URI=http://localhost:3000/callback \
      npx jest
    grep -hE "^Tests:" "$LOG_DIR"/backend_tests.log 2>/dev/null | sed 's/^/    /'
  fi
fi

if [ "$RUN_FRONTEND" = 1 ]; then
  echo; echo "── Frontend ──"
  if need_modules Groupify-frontend "npm ci --legacy-peer-deps"; then
    run_step "frontend lint" Groupify-frontend npx eslint . --quiet
    run_step "frontend tests" Groupify-frontend npx vitest run
    sed 's/\x1b\[[0-9;]*m//g' "$LOG_DIR"/frontend_tests.log 2>/dev/null | grep -E "^ *Tests +[0-9]" | sed 's/^ */    /'
    run_step "frontend build" Groupify-frontend npx vite build

    # Type errors only in the files this branch touched (the repo has a
    # pre-existing backlog, tracked in its own issue).
    printf '▶ %-32s' "type errors in touched files"
    TOUCHED_TS="$(printf '%s\n' "$CHANGED" | grep -E '^Groupify-frontend/src/.*\.tsx?$' | sed 's#^Groupify-frontend/##' || true)"
    TSC_OUT="$(cd Groupify-frontend && npx tsc --noEmit -p . 2>&1 || true)"
    NEW_ERRS=""
    if [ -n "$TOUCHED_TS" ]; then
      NEW_ERRS="$(printf '%s\n' "$TSC_OUT" | grep -F -f <(printf '%s\n' "$TOUCHED_TS") || true)"
    fi
    if [ -z "$NEW_ERRS" ]; then
      echo "pass"; RESULTS+=("PASS  type errors in touched files")
    else
      echo "FAIL"; FAILED=1; RESULTS+=("FAIL  type errors in touched files")
      printf '%s\n' "$NEW_ERRS" | sed 's/^/    /'
    fi
  fi
fi

echo; echo "── Summary ──"
printf '%s\n' "${RESULTS[@]}"
if [ "$FAILED" = 0 ]; then
  echo "All checks passed. Still do the manual checks (UI at 375 px; playback checklist if relevant)."
else
  echo "Some checks failed."
fi
exit "$FAILED"
