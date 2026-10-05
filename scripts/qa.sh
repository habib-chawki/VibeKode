#!/usr/bin/env bash
# QA gate for agents, humans and CI: Biome, typecheck, build, Vitest, Playwright.
# Passing sections only write to their log; failing sections print it. Exit 1 on any failure.
# Usage: scripts/qa.sh   (or npm run qa). Logs go to $QA_LOG_DIR (default .qa/).
set -uo pipefail
cd "$(dirname "$0")/.."

export NO_COLOR=1 FORCE_COLOR=0
LOG_DIR=${QA_LOG_DIR:-.qa}
mkdir -p "$LOG_DIR"
rm -f "$LOG_DIR"/*.log

summary=()
failed=0

section() {
  local name=$1 log="$LOG_DIR/$1.log" start=$SECONDS
  shift
  if "$@" >"$log" 2>&1; then
    echo "$name: PASS"
    summary+=("PASS $name ($((SECONDS - start))s)")
  else
    echo "$name: FAIL"
    cat "$log"
    echo
    summary+=("FAIL $name ($((SECONDS - start))s, log $log)")
    failed=1
  fi
}

section biome npx biome check --colors=off --error-on-warnings
section typecheck npm run typecheck --silent
section build npm run build --silent
section vitest npx vitest run
section playwright npx playwright test

echo
echo "QA summary:"
printf '  %s\n' "${summary[@]}"
if [ "$failed" -ne 0 ]; then
  echo "QA FAILED"
  exit 1
fi
echo "QA PASSED"
