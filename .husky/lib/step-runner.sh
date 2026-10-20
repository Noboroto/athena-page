#!/usr/bin/env bash

# Shared step runner for the git hooks.
#
# Why this exists: a hook runs several long checks in sequence, and the lines
# that say WHAT broke (which lint rule, which test, which type error) end up an
# unpredictable distance from the end of the output. Anyone reading the tail of
# `git commit` / `git push` - a person scrolling, or an agent piping to `tail` -
# would otherwise see only "exit code 1" and have to re-run the check by hand
# just to find out what failed. So: tee every step to its own log, and on
# failure reprint a distilled slice of that log LAST, after the step's name.
#
# Requires `set -Eeuo pipefail` in the sourcing hook: `-E` so the ERR trap is
# inherited by functions, `pipefail` so the `| tee` pipeline reports the
# command's failure rather than tee's success.
#
# `tee` is NOT assumed to exist. GitHub Desktop drives git through its bundled
# MinGit, whose `usr/bin` omits it, so every push from the desktop client died
# at exit 127 before a single check had run - the gate looked hostile rather
# than broken. The fallback below keeps both halves of what tee gave us (the
# log file and the visible output), losing only live streaming.

TEE_BIN="$(command -v tee || true)"
HOOK_LOG_DIR="$(git rev-parse --git-dir)/hook-logs"
rm -rf "$HOOK_LOG_DIR"
mkdir -p "$HOOK_LOG_DIR"
CURRENT_STEP=""
CURRENT_LOG=""

# Pull the lines worth reading out of a failed step's log. Unknown steps fall
# back to the tail, so a new step still says something useful without needing
# a case arm here.
distill_failure() {
  local step="$1" log="$2"
  case "$step" in
    *eslint*)
      grep -E '^\s+[0-9]+:[0-9]+\s+(error|warning)|^[A-Za-z]:\\|^/' "$log" | head -40
      echo
      echo "Gợi ý: phần lớn lỗi loại này tự sửa được bằng \`pnpm lint --fix\`."
      ;;
    *typecheck*)
      grep -E 'error TS[0-9]+' "$log" | head -40
      ;;
    *vitest*)
      # The failure banner onwards already carries the assertion diffs.
      sed -n '/Failed Tests/,$p' "$log" | head -60
      ;;
    *prettier*)
      grep -E '\[error\]' "$log" | head -40
      ;;
    *)
      tail -40 "$log"
      ;;
  esac
}

on_hook_failure() {
  local code=$?
  trap - ERR
  if [[ -n "$CURRENT_STEP" ]]; then
    echo
    echo "════════════════════════════════════════════════════════════"
    echo "✖ ${HOOK_NAME:-hook} HỎNG — bước: $CURRENT_STEP"
    echo "════════════════════════════════════════════════════════════"
    if [[ -s "$CURRENT_LOG" ]]; then
      # A step whose tool DIED (out of memory, exit 127, a config error at
      # startup) emits none of the shapes `distill_failure` greps for, so it
      # comes back empty and the hook used to print a step name and nothing
      # else. That has cost real debugging time twice - an eslint heap OOM and
      # a vitest exit 127 misread as a failing test - so fall back to the tail
      # rather than staying silent about why the step died.
      local distilled
      distilled=$(distill_failure "$CURRENT_STEP" "$CURRENT_LOG")
      if [[ -n "${distilled//[[:space:]]/}" ]]; then
        printf '%s\n' "$distilled"
      else
        echo "(khong khop mau loi quen thuoc — cong cu co the da chet truoc khi chay; duoi log:)"
        tail -40 "$CURRENT_LOG"
      fi
      echo
      echo "Log đầy đủ của bước này: $CURRENT_LOG"
    fi
    echo "════════════════════════════════════════════════════════════"
  fi
  exit "$code"
}

run_step() {
  CURRENT_STEP="$1"
  shift
  CURRENT_LOG="$HOOK_LOG_DIR/$(printf '%s' "$CURRENT_STEP" | tr -c 'A-Za-z0-9' '_').log"
  echo "▶ $CURRENT_STEP"
  if [[ -n "$TEE_BIN" ]]; then
    "$@" 2>&1 | "$TEE_BIN" "$CURRENT_LOG"
  else
    # `|| code=$?` is what keeps `set -e` from killing the hook here: the
    # failure has to survive long enough for the output to be printed and for
    # the ERR trap to name the step.
    local code=0
    "$@" >"$CURRENT_LOG" 2>&1 || code=$?
    cat "$CURRENT_LOG"
    return "$code"
  fi
}
