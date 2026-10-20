#!/usr/bin/env bash
# Run a content-writing script, commit what it changed to main, push, then trigger the deploy.
#
#   commit-loop.sh <script.mjs>
#
# Environment:
#   GH_TOKEN           token with contents:write + actions:write (the workflow's GITHUB_TOKEN)
#   GITHUB_REPOSITORY  owner/name, used for the deploy dispatch
#   PAYLOAD            forwarded untouched to the script
#   DRY_RUN            "true" = show the diff, do not push, do not dispatch
#   STAGE_PATHS        space-separated pathspecs the script may change (default: src/content public/images)
#
# The script writes its commit message to $COMMIT_MESSAGE_FILE and exits non-zero on any rejected
# request (never retried). A rejected push (the CMS committed in between) resets to origin/main and
# re-runs the script from scratch, so nothing is ever rebased. The deploy is dispatched on every
# successful run, even when nothing changed, so a previous run whose dispatch failed gets repaired.
set -euo pipefail

SCRIPT="${1:?usage: commit-loop.sh <script.mjs>}"
REF=main # fixed on purpose: the payload never chooses the branch
DRY_RUN="${DRY_RUN:-false}"
read -r -a STAGE <<<"${STAGE_PATHS:-src/content public/images}"
MESSAGE_DIR="$(mktemp -d)"
export COMMIT_MESSAGE_FILE="$MESSAGE_DIR/message"
trap 'rm -rf "$MESSAGE_DIR"' EXIT

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# Credentials are passed through the environment of a single git command and never stored.
git_auth() {
  local header
  header="AUTHORIZATION: basic $(printf 'x-access-token:%s' "${GH_TOKEN:-}" | base64 | tr -d '\n')"
  GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="http.https://github.com/.extraheader" GIT_CONFIG_VALUE_0="$header" \
    git "$@"
}

settled=false
for attempt in 1 2 3; do
  git_auth fetch --quiet origin "$REF"
  git reset --hard --quiet "origin/$REF"
  # A pathspec that matches nothing is a fatal git error, so only pass paths that exist.
  PATHS=()
  for p in "${STAGE[@]}"; do [ -e "$p" ] && PATHS+=("$p"); done
  [ "${#PATHS[@]}" -gt 0 ] && git clean -fdq -- "${PATHS[@]}"
  rm -f "$COMMIT_MESSAGE_FILE"

  env -u GH_TOKEN node "$SCRIPT"

  PATHS=()
  for p in "${STAGE[@]}"; do [ -e "$p" ] && PATHS+=("$p"); done
  [ "${#PATHS[@]}" -gt 0 ] && git add -A -- "${PATHS[@]}"
  if git diff --cached --quiet; then
    echo "Không có thay đổi để commit."
    settled=true
    break
  fi
  if [ "$DRY_RUN" = "true" ]; then
    echo "::notice::dry_run: không push, không deploy."
    git diff --cached --stat
    git diff --cached --text -- . ':(exclude)*.webp' | head -c 20000
    exit 0
  fi
  message="$(head -n 1 "$COMMIT_MESSAGE_FILE" 2>/dev/null || true)"
  git commit --quiet -m "${message:-chore: update content via CMS action}"
  if git_auth push --quiet origin "HEAD:$REF"; then
    settled=true
    break
  fi
  echo "::warning::Push bị từ chối (lần $attempt/3), chạy lại từ origin/$REF."
  sleep "${RETRY_SLEEP:-3}"
done

if [ "$settled" != "true" ]; then
  echo "::error::Không push được sau 3 lần thử."
  exit 1
fi
if [ "$DRY_RUN" = "true" ]; then
  exit 0
fi

# GITHUB_TOKEN pushes never start the push-triggered deploy; workflow_dispatch is exempt.
for attempt in 1 2 3; do
  if gh workflow run deploy.yml --ref "$REF" --repo "${GITHUB_REPOSITORY:?}"; then
    echo "Đã kích hoạt deploy."
    exit 0
  fi
  sleep "${RETRY_SLEEP:-3}"
done
echo "::error::Không kích hoạt được deploy.yml; chạy lại workflow này để thử lại."
exit 1
