# Vận hành CMS

Dành cho owner/admin. Tài liệu này chỉ ghi quyết định, vị trí cấu hình và quy trình; không chứa giá trị secret. Secret nằm ở Vercel env, 1Password hoặc DB mã hoá của CMS.

## 1. Kiến trúc

```text
Người viết ──đăng nhập email OTP / Google──> https://editor.athena.noboroto.id.vn
   Vercel project `athena-cms` (team tus-projects-a97a9691, region sin1)
   code: fork Noboroto/pagescms, nhánh `deploy`, từ tag 2.1.8 + vá riêng
        │ DATABASE_URL (Neon `athena-cms-db`, sin1)
        └ GitHub App "Athena Lab CMS" ──> repo Noboroto/athena-page (commit, dispatch workflow)
                                              └ push main ──> deploy.yml ──> https://athena.noboroto.id.vn
```

- Lý do tự host: người viết không cần tài khoản GitHub; đăng nhập qua email OTP. Phương án thay thế không cần tài khoản Git (Sveltia, Decap) đều đòi tài khoản Git hoặc auth proxy riêng.
- Fork giữ nguyên upstream ngoài các vá có chủ đích (đăng nhập Google + One Tap, cấu hình Brevo từ giao diện). Danh sách vá và lý do nằm ở `PATCHES.md` trong repo fork (`Noboroto/pagescms`).
- Cấu hình form và nút của CMS nằm ở [`.pages.yml`](../.pages.yml) của repo này. File đó chỉ định hình giao diện, **không phải lớp bảo vệ**: mỗi workflow tự kiểm payload theo allowlist ([`.github/scripts/payload.mjs`](../.github/scripts/payload.mjs), [`collections.mjs`](../.github/scripts/collections.mjs), [`safe-path.mjs`](../.github/scripts/safe-path.mjs)).
- Nội dung ghi thẳng vào `main`, không qua PR; `draft` là cơ chế nháp. Danh tính commit là người viết (email của họ nằm trong commit metadata và log Actions của repo public, đã được chủ dự án chấp nhận).

## 2. Cấu hình ở CMS `/settings`

Chỉ **repo owner** thấy hai thẻ này: người có tài khoản GitHub trùng chủ sở hữu GitHub App (Noboroto). Cài đặt GitHub App không đủ; người đăng nhập bằng email OTP hoặc Google không bao giờ là owner. Đăng nhập GitHub bằng tài khoản owner trước.

### Google sign-in + One Tap

1. Google Cloud Console: tạo OAuth client loại Web application.
2. Điền đúng hai giá trị mà thẻ "Google sign-in" hiển thị:
   - Authorized JavaScript origin: `https://editor.athena.noboroto.id.vn`
   - Authorized redirect URI: `https://editor.athena.noboroto.id.vn/api/auth/callback/google`
3. Dán Client ID và Client secret vào thẻ rồi bật. Secret chỉ ghi, không đọc lại được, và lưu mã hoá AES-GCM bằng `CRYPTO_KEY` (bảng `google_auth_setting`). Không có biến môi trường cho Google.
4. Chỉ email đã xác minh và thuộc `ADMIN_EMAILS`, collaborator hoặc lời mời mới đăng ký được; Google không tự tạo tài khoản cho người lạ.

### Brevo

1. Brevo: tạo transactional API key và một sender đã xác thực (domain/subdomain gửi mail có DKIM và DMARC).
2. Thẻ "Email (Brevo)": dán API key (chỉ ghi), nhập sender, bấm **Send test email**. Lưu mã hoá bằng `CRYPTO_KEY` (bảng `brevo_mail_setting`).
3. Khi đã cấu hình, mọi email (OTP, lời mời) đi qua Brevo HTTP API; nếu chưa thì CMS dùng các biến `EMAIL_PROVIDER`, `RESEND_*`, `SMTP_*` như upstream.
4. Brevo, Security, **Authorized IPs**: không được chặn key này. Vercel không có IP cố định, nên bật chặn IP sẽ làm mọi email thất bại.
5. Brevo vô hiệu key nếu lâu không gửi được email nào. Health workflow nhắc hằng tháng ([mục 8](#8-health-workflow)): đăng nhập bằng OTP một lần để giữ key sống.

## 3. Biến môi trường trên Vercel (Production)

Tên biến lấy từ `.env.local.example` của fork; giá trị chỉ ở Vercel (`vercel env ls`) và 1Password.

| Biến                                                                            | Ghi chú                                                                                            |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                  | Neon integration inject (pooled). Kèm `POSTGRES_MAX_CONNECTIONS=1` cho serverless                  |
| `BASE_URL`                                                                      | `https://editor.athena.noboroto.id.vn`; là gốc của callback, webhook và URL hiển thị ở `/settings` |
| `BETTER_AUTH_SECRET`                                                            | Xoay thì mọi người bị đăng xuất                                                                    |
| `CRYPTO_KEY`                                                                    | **Không bao giờ xoay**: nó mã hoá token GitHub, cấu hình Google và Brevo trong DB                  |
| `GITHUB_APP_ID`, `GITHUB_APP_NAME`, `GITHUB_APP_PRIVATE_KEY`                    | Từ GitHub App (PEM nhiều dòng, dán nguyên)                                                         |
| `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` | Từ GitHub App; webhook secret được đặt qua API (xem mục 5)                                         |
| `ADMIN_EMAILS`                                                                  | Email được vào khu admin và được phép đăng ký lần đầu                                              |
| `EMAIL_FROM`                                                                    | Địa chỉ gửi mặc định                                                                               |
| `EMAIL_PROVIDER`, `SMTP_*`, `RESEND_*`                                          | Chỉ là phương án dự phòng khi Brevo chưa cấu hình ở `/settings`                                    |

Đổi biến cần deploy lại project `athena-cms` mới có hiệu lực. Không commit `.env*` (repo bị chặn ở `.gitignore`).

## 4. Mời người viết

1. Đăng nhập CMS bằng tài khoản owner, mở repo `athena-page`, vào **Collaborators**.
2. Nhập email người viết (không cần GitHub) và gửi lời mời. Mail đi qua Brevo; nhắc họ kiểm Spam.
3. Người được mời đăng nhập bằng email OTP hoặc Google đúng email đó ([Hướng dẫn viết bài](content-guide.md#1-đăng-nhập)).
4. Xoá quyền: xoá email khỏi Collaborators.

## 5. GitHub App

- App "Athena Lab CMS" (slug `athena-lab-cms`), **private**, cài **chỉ** vào `Noboroto/athena-page`.
- Quyền cần: Contents (đọc/ghi), Actions (đọc/ghi, để bấm nút gọi workflow), Metadata, Checks, Commit statuses (đọc), Email addresses (đọc). **Administration đã bị gỡ** vì CMS chỉ cần nó cho tính năng tạo repo từ template, không dùng.
- Webhook secret được đặt qua API vì manifest của setup không nhận trường này.
- Sau mỗi lần nâng cấp fork, mở trang cài đặt của App và kiểm lại danh sách quyền; bản mới có thể xin thêm quyền (kể cả Administration) và cần bạn duyệt. Không duyệt quyền không cần.
- Cài lại hoặc đổi App: chạy script `setup:github-app` của fork với `--base-url https://editor.athena.noboroto.id.vn`, gỡ Administration, cài vào đúng một repo, cập nhật 6 biến `GITHUB_APP_*` trên Vercel rồi xoá `.env` cục bộ.

## 6. Nâng cấp fork

Repo fork: `Noboroto/pagescms`, nhánh `deploy` (production của Vercel).

1. Đọc release notes của upstream (biến môi trường mới, quyền App mới, migration).
2. Tạo branch Neon làm điểm lui, ví dụ `neonctl branches create --name pre-<tag>` (kiểm cờ bằng `neonctl branches create --help`).
3. Trong repo fork: `git fetch upstream --tags`, `git switch deploy`, `git merge <tag>`, xử lý xung đột ở các file được liệt kê trong `PATCHES.md`, push. Vercel build và chạy migration (`postbuild`).
4. Hỏng: revert nhánh `deploy` về commit trước, deploy lại, khôi phục DB từ branch Neon đã tạo.
5. Kiểm lại quyền GitHub App (mục 5), đăng nhập thử, mở một collection, lưu một bài nháp và xác nhận `deploy.yml` chạy (event push).
6. Ghi vá mới (nếu có) vào `PATCHES.md`.

## 7. Xoay secret

| Secret                                 | Cách xoay và hậu quả                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brevo API key                          | Tạo key mới ở Brevo, dán lại ở `/settings`, gửi email thử, rồi thu hồi key cũ                                                                                     |
| Google Client secret                   | Tạo secret mới ở Google Cloud, dán lại ở `/settings`                                                                                                              |
| `BETTER_AUTH_SECRET`                   | Đổi trên Vercel và deploy lại; mọi người phải đăng nhập lại                                                                                                       |
| GitHub App private key / client secret | Tạo mới ở trang App, cập nhật biến Vercel, deploy lại                                                                                                             |
| `CRYPTO_KEY`                           | **Không xoay.** Đổi sẽ làm hỏng token GitHub đã lưu, cấu hình Google và Brevo; chỉ chấp nhận khi dựng lại từ đầu (nhập lại mọi cấu hình, mọi người đăng nhập lại) |

Nếu nghi lộ secret: thu hồi ở nguồn (Brevo, Google, GitHub) trước, rồi cập nhật Vercel.

## 8. Health workflow

[`.github/workflows/health.yml`](../.github/workflows/health.yml) chạy 02:00 UTC ngày 1 hằng tháng (và thủ công qua `workflow_dispatch`, chỉ trên `main`). Script [`health-check.sh`](../.github/scripts/health-check.sh):

- Gọi editor và site; không trả HTTP 200 thì mở/comment issue nhãn `incident` và workflow đỏ.
- Luôn mở/comment issue nhãn `maintenance`: đăng nhập OTP một lần, kiểm hạn mức Brevo, Neon, Vercel, xem có bản Pages CMS mới.
- GitHub tự tắt workflow theo lịch sau 60 ngày repo không có hoạt động: bật lại ở tab Actions hoặc chạy tay.

## 9. Giới hạn đã biết

- GitHub giới hạn input của `workflow_dispatch` ở 65.535 ký tự và CMS gửi cả bài vào payload. Bài quá dài làm nút **Nhân bản** và **Tạo bản tiếng Anh** thất bại; **Tạo từ mẫu** và **Tối ưu ảnh** không bị ảnh hưởng. Cách xử lý: tạo bản sao bằng git hoặc giao diện web GitHub, chép file sang `src/content/<news|projects>/en/` đúng tên file bản vi.
- Các nút ghi nội dung chạy tuần tự (`concurrency` nhóm `content-writes`); GitHub chỉ giữ một lượt chờ, nên ba yêu cầu đồng thời thì yêu cầu giữa bị thay thế. Chạy lại nút.

## 10. Runbook sự cố

### Có issue `deploy-attention`

[`notify-deploy.sh`](../.github/scripts/notify-deploy.sh) mở (hoặc comment) một issue duy nhất nhãn `deploy-attention` và tự đóng khi build xanh và không còn bài bị cách ly.

1. Mở issue, xem danh sách file và lỗi, hoặc mở log run được link.
2. **Bài bị cách ly** (site vẫn deploy phần còn lại): sửa file trong CMS (điền `[[…]]`, sửa link hỏng) hoặc đặt `draft: true`, lưu. Deploy kế tiếp tự đóng issue.
3. **Build hỏng** (site cũ được giữ nguyên, thường do lỗi schema hoặc frontmatter hỏng): xem log bước build, sửa file lỗi, hoặc revert như dưới.

### Revert commit nội dung xấu

```bash
git switch main && git pull
git revert <sha>
git push origin main
```

Push lên `main` kích hoạt `deploy.yml`. Nếu commit được tạo bởi một workflow nút bấm mà deploy không chạy, kích hoạt tay: `gh workflow run deploy.yml --ref main`. Sau revert, issue tự đóng ở lần deploy xanh.

### Thành viên đổi tên, hoặc hồ sơ bị gõ đè

Họ tên bị khoá trong CMS sau khi tạo và CMS không cho đổi tên file thành viên, vì tên file là URL `/members/<slug>/` và là giá trị mà `members`, `author`, `authors` của tin, dự án, paper trỏ tới. Đổi bằng git:

1. **Người thật sự đổi tên**: `git mv src/content/members/<cũ>.md src/content/members/<mới>.md`, sửa `name` trong file, rồi thay `<cũ>` bằng `<mới>` trong `members:`/`author:`/`authors:` của mọi file dưới `src/content/` (`git grep -n '<cũ>' src/content`). Đổi tên ảnh đại diện thì sửa luôn `avatar`.
2. **Hồ sơ người B bị gõ đè lên bài người A** (bài A bị cách ly vì Họ tên không khớp tên file): chuyển nội dung của B sang file mới (`git mv` như trên, không sửa các tham chiếu vì chúng thuộc về A), rồi khôi phục file A từ commit trước khi bị đè (`git log -- <file A>`, `git show <sha>:<file A> > <file A>`).
3. `node scripts/check-content.mjs` phải báo sạch trước khi push.

### Editor không vào được

1. Xem issue `incident` do health workflow mở (chạy hằng tháng, không thay cho việc kiểm tay).
2. Vercel dashboard, project `athena-cms`: xem deployment và log (gói Hobby giữ log ngắn, tra ngay khi có báo cáo).
3. Neon `athena-cms-db`: DB ngủ có thể chậm vài giây ở lần đầu.
4. Site công khai không phụ thuộc editor: vẫn chạy khi CMS hỏng. Nội dung có thể sửa trực tiếp bằng git.
