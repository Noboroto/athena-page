# Triển khai và cấu trúc repo

Dành cho developer. Quy tắc làm việc với repo (tool, hook, review) nằm ở [AGENTS.md](../AGENTS.md); tài liệu này chỉ nói kiến trúc triển khai và cách chạy.

## 1. Kiến trúc

| Thành phần | Nơi chạy                                                         | Ghi chú                                                           |
| ---------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Site tĩnh  | GitHub Pages, https://athena.noboroto.id.vn                      | Astro build trong `deploy.yml`, chỉ từ `main`                     |
| Nội dung   | Markdown trong `src/content/` + `src/data/site.yml`              | Repo public `Noboroto/athena-page`                                |
| CMS        | Vercel `athena-cms` + Neon, https://editor.athena.noboroto.id.vn | Xem [Vận hành CMS](cms-operations.md)                             |
| Nút CMS    | GitHub Actions `workflow_dispatch`                               | `clone-entry.yml`, `optimize-images.yml`, cấu hình ở `.pages.yml` |

Luồng: người viết lưu bài trong CMS, CMS commit vào `main`, push kích hoạt `deploy.yml`. Nút bấm trong CMS chạy workflow ghi nội dung; vì commit bằng `GITHUB_TOKEN` không kích hoạt workflow khác, script [`commit-loop.sh`](../.github/scripts/commit-loop.sh) luôn tự dispatch `deploy.yml` trên `main` sau khi push.

Bản đồ thư mục:

- `src/content.config.ts`: nguồn duy nhất của schema nội dung (members, papers, projects, news).
- `src/pages/[...locale]/`: route chung cho `vi` (không prefix) và `en` (`/en/…`); feed ở `src/pages/{rss.xml.ts,en/rss.xml.ts,papers/rss.xml.ts}`.
- `src/i18n/{vi,en}.json`, `src/lib/`, `src/components/`, `src/layouts/`.
- `templates/`: mẫu cho nút "Tạo từ mẫu" (ngoài `src/content/` để không lên site), xem [templates/README.md](../templates/README.md).
- `scripts/`: `check-content.mjs` và test của nó, `lib/` dùng chung với script workflow.
- `.github/workflows/`, `.github/scripts/`: workflow và script của chúng; `.github/scripts` là một gốc pnpm riêng (chỉ `yaml`, `sharp`).
- `.pages.yml`: form và nút của CMS (không phải lớp bảo vệ).
- `.husky/`: git hook.

## 2. Tên miền và DNS

Zone `noboroto.id.vn` trên Cloudflare, tất cả bản ghi để **DNS only** (không proxy):

| Tên             | Loại  | Giá trị                | Dùng cho                   |
| --------------- | ----- | ---------------------- | -------------------------- |
| `athena`        | CNAME | `noboroto.github.io`   | GitHub Pages               |
| `editor.athena` | CNAME | `cname.vercel-dns.com` | Vercel (CMS)               |
| `_vercel`       | TXT   | giá trị Vercel cấp     | Xác minh domain cho Vercel |

Kiểm tra nhanh: `dig +short CNAME athena.noboroto.id.vn` và `dig +short CNAME editor.athena.noboroto.id.vn`. Bản ghi gửi mail (DKIM, DMARC) thuộc về Brevo, xem [Vận hành CMS](cms-operations.md#brevo).

## 3. Cài đặt GitHub Pages

Cài ở repo Settings; kiểm bằng `gh api repos/Noboroto/athena-page/pages`:

- **Source = GitHub Actions** (`build_type: workflow`), không dùng nhánh `gh-pages`.
- **Custom domain** `athena.noboroto.id.vn`, **Enforce HTTPS** bật. Không cần file `public/CNAME` vì domain đặt trong Settings khi dùng Actions.
- Environment **`github-pages`**: Deployment branches chỉ cho phép `main` (custom branch policy `main`). Kiểm: `gh api repos/Noboroto/athena-page/environments/github-pages/deployment-branch-policies`.
- Quyền mặc định của `GITHUB_TOKEN` là chỉ đọc; từng workflow tự xin quyền cần thiết ở cấp job (top-level `permissions: {}`).

## 4. `deploy.yml`

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) chạy khi push `main` và khi `workflow_dispatch` (job bị bỏ qua nếu ref khác `main`). Ba job:

1. **build**: cài deps, chạy `pnpm check`, `pnpm lint`, `pnpm test`, rồi `node scripts/check-content.mjs --quarantine`, rồi `pnpm astro build`. Gọi `astro build` trực tiếp để hook `prebuild` (check-content nghiêm) không chạy lại sau bước cách ly. Upload artifact Pages và artifact `quarantine`.
2. **deploy**: `actions/deploy-pages` vào environment `github-pages`.
3. **notify**: chạy [`notify-deploy.sh`](../.github/scripts/notify-deploy.sh): mở hoặc comment issue nhãn `deploy-attention` khi build/deploy hỏng hoặc có bài bị cách ly; đóng issue khi sạch.

### Cách ly (quarantine)

Lý do: một bài lỗi của một người không được chặn deploy của cả nhóm.

- [`scripts/check-content.mjs`](../scripts/check-content.mjs) tách lỗi thành hai loại. **Lỗi cấu trúc** (frontmatter không đọc được, thiếu key i18n, `site.yml` hỏng hoặc còn email `example.com`) luôn dừng build. **Lỗi nội dung** của bài không nháp (còn `[[…]]` hoặc `\[\[`, ảnh hoặc tham chiếu không tồn tại, tên file không phải kebab-case) bị cách ly khi có `--quarantine`, và chặn cứng khi không có cờ.
- Chế độ `--quarantine` ghi `src/.quarantine.json` (và `quarantine.md` cho issue). `getPublished()` trong `src/lib/content.ts` bỏ các file trong danh sách; cả hai file đều nằm trong `.gitignore`.
- Lỗi schema Zod của `src/content.config.ts` không thuộc loại này: build đỏ, site cũ giữ nguyên.
- Local, `pnpm build` chạy `prebuild` = check-content nghiêm, nên cùng một bài sẽ làm build local thất bại.

## 5. Dependabot và ghim phiên bản

[`.github/dependabot.yml`](../.github/dependabot.yml) cập nhật hằng tuần ba nơi: GitHub Actions, npm ở `/` và npm ở `/.github/scripts`. Action trong workflow ghim theo SHA (kèm comment tag); `pages-yml.test.mjs` kiểm điều này cùng các ràng buộc quyền và guard `main`. Phiên bản pnpm ghim ở `packageManager`; Node theo `.nvmrc` và `engines`.

## 6. Phát triển local

Cần Node 24 và pnpm theo `packageManager`.

```bash
pnpm install
pnpm dev            # http://localhost:4321
pnpm check          # astro check
pnpm lint           # eslint, không cho phép warning
pnpm test           # node:test: scripts/** và .github/scripts/**
pnpm format:check   # prettier (pnpm format:fix để sửa)
pnpm build          # prebuild (check-content nghiêm) rồi astro build
```

Test của workflow dùng `sharp` có trong `.github/scripts`; nếu chưa cài thì test ảnh tự bỏ qua. Để chạy đủ: `pnpm --dir .github/scripts install --frozen-lockfile`.

### Ghi đè site và base

[`site.config.mjs`](../site.config.mjs) là nơi duy nhất giữ origin và base path. Ghi đè bằng biến môi trường khi cần build cho host khác:

```bash
ATHENA_SITE=https://example.test ATHENA_BASE=/athena pnpm build
```

Mọi URL nội bộ đi qua `withBase()` (`src/lib/url.ts`) hoặc `localePath()` (`src/i18n`); không viết `href="/…"` trần.

### Git hook

Cài tự động bởi `prepare` (`husky` và `scripts/fix-hook-perms.mjs`). Khai báo ở `.husky/`:

- `pre-commit`: chặn quá 50 file staged hoặc file nguồn dài thêm quá 1000 dòng; chạy `pnpm format:fix`, `pnpm check`, `pnpm lint`, `pnpm test`. Commit chỉ gồm `.md` bỏ qua các bước này.
- `pre-push`: `pnpm format:check`, `check`, `lint`, `test`, `build`; push chỉ `.md` bỏ qua.
- `commit-msg`: chặn nhắc tên AI trong commit message (cho phép `CLAUDE.md`).
- Phần khoá tài nguyên (`lib/heavy-lock.sh`, `lib/hook-env.sh`) chép từ repo Leaderboard; chi tiết vận hành ở AGENTS.md mục 5 và 6.

## 7. Thêm hoặc đổi một trường nội dung

Đổi theo thứ tự, cùng một commit:

1. `src/content.config.ts` (nguồn schema).
2. `.pages.yml` (form), giữ cặp `news-vi`/`news-en` và `projects-vi`/`projects-en` cùng danh sách trường (alias YAML dùng chung); `pages-yml.test.mjs` bắt lệch.
3. Mẫu trong `templates/` và `.github/scripts/collections.mjs` nếu trường liên quan tới nút bấm.
4. `src/i18n/{vi,en}.json` nếu thêm nhãn (check-content bắt lệch key giữa hai ngôn ngữ).
5. Chạy `pnpm test` và `pnpm build`.
