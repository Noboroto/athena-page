#!/usr/bin/env bash
# Monthly health check: the CMS and the public site must answer 200, and an admin is reminded to
# keep the Brevo SMTP key alive (it is deactivated after 90 days without a successful send).
#
# Environment: GH_TOKEN, REPO (owner/name), RUN_URL, optional CMS_URL / SITE_URL / RETRY_SLEEP.
# Issues are de-duplicated: an open issue with the same label gets a comment instead of a new issue.
set -uo pipefail

CMS_URL="${CMS_URL:-https://editor.athena.noboroto.id.vn/}"
SITE_URL="${SITE_URL:-https://athena.noboroto.id.vn/}"
REPO="${REPO:?REPO is required}"
RUN_URL="${RUN_URL:-}"
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

status_of() {
  curl -sSL -o /dev/null -w '%{http_code}' --max-time 20 --retry 2 --retry-delay "${RETRY_SLEEP:-5}" "$1" 2>/dev/null || true
}

# open_or_comment <label> <title> <color> ; body is read from $BODY_FILE
open_or_comment() {
  local label="$1" title="$2" color="$3" number
  number="$(gh issue list --repo "$REPO" --label "$label" --state open --limit 1 --json number --jq '.[0].number // empty')"
  if [ -n "$number" ]; then
    gh issue comment "$number" --repo "$REPO" --body-file "$BODY_FILE"
  else
    gh label create "$label" --repo "$REPO" --color "$color" --force >/dev/null
    gh issue create --repo "$REPO" --title "$title" --label "$label" --body-file "$BODY_FILE"
  fi
}

failures=()
for entry in "CMS|$CMS_URL" "Site|$SITE_URL"; do
  name="${entry%%|*}"
  url="${entry#*|}"
  code="$(status_of "$url")"
  echo "$name $url -> ${code:-none}"
  if [ "$code" != "200" ]; then
    failures+=("- $name: \`$url\` trả về \`${code:-không kết nối được}\`")
  fi
done

status=0
if [ "${#failures[@]}" -gt 0 ]; then
  {
    echo "Kiểm tra sức khoẻ phát hiện lỗi:"
    echo
    printf '%s\n' "${failures[@]}"
    echo
    echo "Lần chạy: $RUN_URL"
  } >"$BODY_FILE"
  open_or_comment incident "Hệ thống không phản hồi 200" B60205 || true
  status=1
fi

cat >"$BODY_FILE" <<BODY
Nhắc việc hằng tháng cho quản trị viên:

- [ ] Đăng nhập CMS bằng email (mã OTP) để Brevo gửi một email thành công. Khoá SMTP bị vô hiệu sau 90 ngày không gửi được email nào.
- [ ] Kiểm tra hạn mức Brevo (300 email/ngày), Neon (free) và Vercel (Hobby).
- [ ] Xem có bản Pages CMS mới cần merge vào fork không.

Lần chạy: $RUN_URL
BODY
open_or_comment maintenance "Nhắc việc bảo trì hằng tháng" 0E8A16 || true

exit "$status"
