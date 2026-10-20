#!/usr/bin/env bash
# Open / comment / close the `deploy-attention` issue after a deploy run.
#
# Env: GH_TOKEN, REPO (owner/name), RUN_URL, BUILD_RESULT, DEPLOY_RESULT,
#      COUNT (quarantined posts; empty = 0).
# Reads ./quarantine.md when present (written by check-content --quarantine).
# Idempotent: re-running never creates a second open issue.
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${REPO:?REPO is required}"
: "${RUN_URL:?RUN_URL is required}"
: "${BUILD_RESULT:?BUILD_RESULT is required}"
: "${DEPLOY_RESULT:?DEPLOY_RESULT is required}"
COUNT="${COUNT:-0}"
[[ "$COUNT" =~ ^[0-9]+$ ]] || COUNT=0

LABEL="deploy-attention"
TITLE="deploy: cần xử lý"

if [[ "$BUILD_RESULT" == "cancelled" || "$DEPLOY_RESULT" == "cancelled" ]]; then
  echo "Run was cancelled; leaving issues untouched."
  exit 0
fi

body="$(mktemp)"
needs_attention=1
trap 'rm -f "$body"' EXIT

if [[ "$BUILD_RESULT" != "success" || "$DEPLOY_RESULT" != "success" ]]; then
  {
    echo "Build hoặc deploy thất bại (build: ${BUILD_RESULT}, deploy: ${DEPLOY_RESULT}). Site cũ được giữ nguyên."
    echo
    echo "Run: ${RUN_URL}"
  } >"$body"
elif [[ "$COUNT" -gt 0 ]]; then
  {
    echo "${COUNT} bài bị cách ly nên chưa lên site; phần còn lại đã deploy."
    echo
    if [[ -f quarantine.md ]]; then
      # Fenced so markdown typed by authors inside the report cannot render as active content.
      echo '```text'
      head -c 20000 quarantine.md | sed 's/```/` ` `/g'
      echo
      echo '```'
    fi
    echo "Run: ${RUN_URL}"
  } >"$body"
else
  needs_attention=0
fi

# Newest first; empty output when there is none.
open_issues=()
while IFS= read -r n; do
  [[ -n "$n" ]] && open_issues+=("$n")
done < <(gh issue list --repo "$REPO" --label "$LABEL" --state open --limit 100 --json number --jq '.[].number')

if [[ "$needs_attention" -eq 1 ]]; then
  if [[ ${#open_issues[@]} -gt 0 ]]; then
    gh issue comment "${open_issues[0]}" --repo "$REPO" --body-file "$body"
  else
    gh label create "$LABEL" --repo "$REPO" --color D93F0B \
      --description "Deploy bị lỗi hoặc có bài bị cách ly" --force
    gh issue create --repo "$REPO" --title "$TITLE" --label "$LABEL" --body-file "$body"
  fi
else
  for n in ${open_issues[@]+"${open_issues[@]}"}; do
    gh issue close "$n" --repo "$REPO" --comment "Build xanh và không còn bài bị cách ly (${RUN_URL}). Tự đóng."
  done
fi
