# Athena Lab site — Project Instructions

Site tĩnh song ngữ (vi mặc định, en tuỳ chọn) của nhóm nghiên cứu Athena: Papers, Projects, Tin tức, Thành viên.
Astro build tĩnh, nội dung Markdown trong repo, soạn bài qua Pages CMS, deploy GitHub Pages
(custom domain `https://athena.noboroto.id.vn/`, `base: '/'`).

## 0. Luật cứng — quét nhanh trước khi làm

| Tuyệt đối KHÔNG                                           | Vì sao / xem mục                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Commit secret, `.env`, token, khoá riêng                  | Repo PUBLIC (§4)                                                            |
| Hardcode `/` đầu đường dẫn nội bộ, hardcode domain        | Site chạy dưới `base`; dùng `withBase`/`localePath`, `site.config.mjs` (§2) |
| Khai lại schema frontmatter ngoài `src/content.config.ts` | Nguồn duy nhất (§3)                                                         |
| `set:html` với chuỗi người viết nhập                      | Markdown đi qua pipeline sanitize + KaTeX (§4)                              |
| Tin payload Pages CMS / client                            | `.pages.yml` không phải lớp bảo vệ; script tự kiểm allowlist (§4)           |
| Lọc bài theo ngày tương lai                               | Chỉ `draft` quyết định hiển thị (§3)                                        |
| Push workflow deploy / nút CMS chạy ngoài `main`          | Chỉ `main` (§6)                                                             |
| Cài / tự viết script `playwright`, `puppeteer`            | Browser đi qua MCP (§1)                                                     |
| Commit vượt trần số file của hook                         | Hook chặn cứng (§6)                                                         |
| Commit code chưa qua ≥2 agent review                      | Test xanh không thay được review (§9)                                       |
| Chạy nhiều việc nặng song song                            | Máy dùng chung bị đói CPU (§5)                                              |
| Nhắc Claude/Anthropic/Codex/ChatGPT trong commit message  | `commit-msg` chặn (§6)                                                      |

## 1. Tool policy — MCP trước, built-in sau

Trước khi gõ lệnh, hỏi: _"có MCP tool nào làm việc này không?"_ Built-in (Read/Glob/Grep) luôn nạp sẵn nên bị với tới theo phản xạ, trong khi MCP trả lời có cấu trúc, đã đánh chỉ mục, tốn ít token hơn hẳn.
Thứ tự: **MCP → built-in (Read/Glob/Grep) → Bash**.

**Điều hướng & sửa code — `serena`**

| Việc                                  | ĐỪNG                        | DÙNG                                                                 |
| ------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| Tìm symbol (hàm/class/biến)           | `Grep` theo tên             | `find_symbol`, `find_declaration`, `find_implementations`            |
| Tìm nơi gọi / tham chiếu              | `Grep`                      | `find_referencing_symbols`                                           |
| Xem API của file trước khi đọc        | `Read` cả file              | `get_symbols_overview`                                               |
| Sửa thân một symbol                   | `Edit` kèm khối context lớn | `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol` |
| Đổi tên / thay chuỗi toàn repo        | `Grep` + N lần `Edit`       | `rename_symbol`, `replace_in_files`, `replace_content`               |
| Xoá symbol kèm dọn tham chiếu         | `Edit` tay từng chỗ         | `safe_delete_symbol`                                                 |
| Xem lỗi type/lint của 1 file          | chạy cả `tsc --noEmit`      | `get_diagnostics_for_file`                                           |
| Ghi nhớ kiến thức repo giữa các phiên | file rác trong repo         | `write_memory` / `read_memory` / `list_memories`                     |
| Tra lại bài học đã đo được            | suy luận lại từ đầu         | **serena memory TRƯỚC**: `read_memory("core")` → `mem:lessons/index` |

**Serena memory là nơi tra bài học đầu tiên.** Trước khi tự suy luận lại một hành vi, hoặc
kết luận "cái này chắc là…", đọc `mem:core` rồi index chủ đề trong `mem:lessons/index` — sự
thật đã ĐO ĐƯỢC của dự án nằm ở đó, đừng đoán lại. Có bài học mới thì `write_memory` đúng
chủ đề rồi thêm dòng vào index của nó.

**Kiến trúc & review — `code-review-graph`**

| Việc                             | ĐỪNG                  | DÙNG                                                                       |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| Định hướng đầu tiên (~100 token) | đọc lung tung         | `get_minimal_context_tool` — **gọi trước tiên**                            |
| Kiến trúc / bán kính ảnh hưởng   | đọc tay               | `get_architecture_overview_tool`, `get_impact_radius_tool`                 |
| Context cho một diff             | đọc hết file chạm vào | `get_review_context_tool`, `detect_changes_tool`                           |
| Luồng nghiệp vụ xuyên module     | lần theo import tay   | `list_flows_tool`, `get_flow_tool`, `get_affected_flows_tool`              |
| Hàm quá lớn / nút thắt / cầu nối | đọc tay               | `find_large_functions_tool`, `get_hub_nodes_tool`, `get_bridge_nodes_tool` |
| Tìm node theo ngữ nghĩa          | `Grep` từ khoá        | `semantic_search_nodes_tool`, `query_graph_tool`, `traverse_graph_tool`    |

**Tài liệu & nghiên cứu ngoài**

| Việc                        | ĐỪNG                 | DÙNG                                               |
| --------------------------- | -------------------- | -------------------------------------------------- |
| Docs thư viện/framework/CLI | trí nhớ, `WebSearch` | `context7`: `resolve-library-id` → `query-docs`    |
| Hiểu repo GitHub bên ngoài  | clone về đọc         | `deepwiki`: `ask_question`, `read_wiki_contents`   |
| Tìm kiếm web                | `curl` trong Bash    | `exa` / `tavily` / `firecrawl` search              |
| Lấy nội dung 1 trang        | `curl` / `wget`      | `WebFetch`; `firecrawl_scrape` khi cần render JS   |
| Rà site / bản đồ URL        | crawl tay            | `firecrawl_map`, `firecrawl_crawl`, `tavily_crawl` |

**Trình duyệt** — mặc định **Playwright MCP**. Dùng `claude-in-chrome` / `chrome-devtools` MCP khi cần đúng phiên Chrome thật đã đăng nhập, hành vi Chrome thật (EditContext), hoặc đo trace/hiệu năng.

**Vẫn dùng Bash cho**: git, package manager, test runner, build, container, chạy executable — đừng né.

**Lưu ý vận hành**

- `serena` / `code-review-graph` **không phủ file untracked** — file mới chưa commit phải `Read` trực tiếp, đừng tin index trả rỗng.
- Index rỗng/cũ **không phải** lý do quay về `Grep`: chạy `build_or_update_graph_tool` (+ `embed_graph_tool`, `run_postprocess_tool`) rồi query lại. Dựng graph **không tính là ghi repo** — agent read-only vẫn được chạy.
- `get_impact_radius_tool` trên một node trung tâm có thể **vượt trần token** (đã đo, và ngưỡng đó lớn dần theo repo) → thu hẹp depth hoặc dùng `get_minimal_context_tool`.
- Tool bị _deferred_ → nạp schema bằng `ToolSearch` **một lần cho cả cụm** (`select:` nhận danh sách phẩy), đừng gọi lẻ từng cái.
- MCP xác thực tương tác (vd `claude-in-chrome`) có thể **vắng trong phiên headless/cron** — đừng phụ thuộc trong luồng tự động.
- `harvest`, `Google Drive` không phục vụ dự án này — không dùng trừ khi user yêu cầu thẳng.

## 2. Tech stack đã chốt

> Không ghi version ở đây: version nằm ở `package.json` và `pnpm-lock.yaml`. Mục này chỉ nói **dùng cái gì và vì sao**.

- **Framework**: Astro (output tĩnh), TypeScript (pin `^6` vì `@astrojs/check` chưa hỗ trợ TS 7), import Zod từ `astro/zod`.
- **Package manager**: pnpm (`packageManager` ghim version; build script được duyệt qua `allowBuilds` trong `pnpm-workspace.yaml`). Node theo `.nvmrc`/`engines`.
- **Markdown**: `unified()` + `remark-math` + `rehype-sanitize` (chạy TRƯỚC) + `rehype-katex` (`trust: false`). Cú pháp `$…$` / `$$…$$`.
- **Tìm kiếm / feed**: Pagefind (`astro-pagefind`), `@astrojs/rss`, `@astrojs/sitemap`.
- **i18n**: `vi` (mặc định, không prefix) + `en` (`/en/...`). Cùng bộ key trong `src/i18n/{vi,en}.json`. Route chung `src/pages/[...locale]/…` + `localeStaticPaths()`. Bản en KHÔNG bắt buộc, không sinh trang en dự phòng.
- **URL**: `site` + `base` lấy từ MỘT chỗ — `site.config.mjs` (env `ATHENA_SITE`/`ATHENA_BASE` ghi đè). Mọi URL nội bộ đi qua `withBase()` (`src/lib/url.ts`) hoặc `localePath()` (`src/i18n`), nối `import.meta.env.BASE_URL`; không viết `href="/..."` trần.
- **Test**: `node:test` (`pnpm test` = `node --test "scripts/**/*.test.mjs" ".github/scripts/**/*.test.mjs"`). KHÔNG Jest/Vitest.
- **Editor / deploy**: Pages CMS tự host (Vercel + Neon), GitHub Actions → GitHub Pages.

## 3. Schema, type & DRY

- **Nguồn duy nhất của schema nội dung: `src/content.config.ts`** (members, papers, projects, news). Đổi tên/kiểu field ở đây ⇒ đổi `.pages.yml`, mẫu bài (`templates/`) và script kiểm tra cùng lúc.
- Tham chiếu tới member/project/paper dùng `slugRef` (chuẩn hoá `x.md` → `x` bằng `toSlug` trong `scripts/lib/slug.mjs`, dùng chung với script). `authors` của paper là slug thành viên HOẶC tên người ngoài.
- Cấu hình site (`src/data/site.yml`) là YAML phẳng, đọc bằng `getSite()` và validate bằng `siteSchema`; không dùng loader `file()`.
- `getPublished()` (`src/lib/content.ts`): production bỏ `draft: true` và file trong `src/.quarantine.json`; **không lọc ngày tương lai**.
- **DRY, YAGNI, KISS**: không lặp logic; không over-engineer. Constant dùng ≥2 file thì có đúng một nơi định nghĩa.
- **Field thừa = STRIP (mặc định)**. Cấm `.strict()` / `.passthrough()` trên Zod.
- **Ưu tiên package có sẵn hơn tự viết** — xem mục ngay dưới.

## Tận dụng package có sẵn

Luật của chủ hệ thống (10/10/2026), áp chung cho JudgeHub, Leaderboard và mọi repo cùng máy:

- **Trước khi dựng một tính năng, module, công cụ hay UI: tìm package/thư viện/template có sẵn** (npm, PyPI, GitHub,
  Context7) đang được bảo trì, rồi dùng hoặc mở rộng nó. Chỉ tự viết phần không package nào phủ được.
- **Không viết lại toàn bộ thứ một package tốt đã làm** — chức năng thông dụng (validation, date, table, form,
  crypto/TOTP, upload, virtualization…) → `pnpm add <pkg>` đúng workspace. Type của thư viện (vd option của antd
  `GetProp<SelectProps, 'options'>[number]`) cũng tính: dùng lại thay vì tự khai shape trùng.
- Chọn theo: còn bảo trì (release gần), license, hợp stack hiện tại, mức phổ biến.
- **Tự viết thì ghi lý do** vào `docs/` hoặc serena memory: đã cân nhắc package nào, vì sao loại từng cái (bundle
  size, security, maintenance, lock-in, chỉ cần một hàm nhỏ).
- Báo cáo/plan so sánh phương án phải liệt kê cả **package hiện có liên quan**, không chỉ framework chung chung.

## 4. Bảo mật & dữ liệu

- **Repo PUBLIC.** Không commit secret/`.env`/token. Email người viết lộ trong commit metadata và log Actions là rủi ro đã được chủ dự án chấp nhận.
- **Payload từ Pages CMS và mọi `workflow_dispatch` input là không tin cậy.** `.pages.yml` KHÔNG phải lớp bảo vệ: mỗi script kiểm payload theo allowlist (collection, đường dẫn, ref `main`) trước khi ghi.
- **XSS**: HTML thô trong Markdown bị `rehype-sanitize` lọc; link `javascript:` bị chặn; KaTeX `trust: false`. Field URL trong schema chỉ nhận `http(s)://` (hoặc đường dẫn `/…` cho file nội bộ).
- Action trong workflow ghim theo SHA; deps của workflow tách riêng khỏi deps site.
- **Timezone cố định Asia/Ho_Chi_Minh (UTC+7)** khi hiển thị ngày, không phụ thuộc client/runner.
- **String**: `trim()` trước khi lưu/so sánh (chuẩn hoá tại Zod).

## 5. Code quality & test

- **ESLint** (flat config, typescript-eslint, eslint-plugin-astro) + **Prettier** (`prettier-plugin-astro`). Test dùng `node:test`.
- **Cấm disable linter vô cớ**: `eslint-comments/no-unlimited-disable` + `require-description` — mọi `eslint-disable` PHẢI kèm lý do.
- **Browser/E2E/live-verify BẮT BUỘC qua MCP** (§1). Cấm cài hoặc tự viết script bằng `playwright`/`puppeteer`.

### Chi phí chạy test — coi là khe CPU độc quyền

Full suite tốn hàng phút và ngốn gần hết CPU máy. Coi mỗi lượt chạy là một khe độc quyền.

- **KHÔNG chạy nhiều thứ nặng song song.** Hậu quả đã đo: nhiều agent cùng chạy vitest chồng lên `docker compose build` → **Docker engine đói CPU trả `500`**, mọi lệnh `docker compose ps/logs` hỏng (container vẫn sống, dễ tưởng nhầm stack sập).
- Agent song song **chỉ an toàn khi thuần đọc/sửa file** với ownership tách rời. Có bước chạy test → tuần tự, hoặc gom về **một** agent verify duy nhất.
- **Máy dùng chung với dự án khác — khoá `/tmp/cc-heavy.lock` chỉ xếp hàng, không đo sức chứa.** Đã đo 30/09/2026: commit
  chạy full suite qua hook (đúng khoá) chồng lên 3 agent + ~8 trình duyệt Playwright của dự án khác chạy ngoài khoá, cùng
  ~19 container → máy treo, watchdog reset. Nên:
  - Trước mỗi bước nặng: `memory_pressure -Q` free ≥ 35% (Windows: ≥ 21%), thấp hơn thì **chờ**.
  - Tính là nặng (phải qua khoá): test do hook commit/push, `pnpm install`, typecheck, docker build, dựng stack app,
    agent lái trình duyệt (Playwright / chrome MCP).
  - Toàn máy tối đa **một** agent vừa sửa vừa test/install/build/lái trình duyệt; không tạo git worktree thêm trừ khi
    thật cần và user đồng ý. Reviewer đọc-thuần không trình duyệt vẫn chạy song song được (số ít).
  - Dev server/stack compose chạy lâu cũng ăn ngân sách: dừng khi tạm nghỉ việc.
  - **Hook tự giữ khoá** qua `.husky/lib/heavy-lock.sh` và nạp PATH qua `.husky/lib/hook-env.sh` — cả hai **chép
    nguyên văn từ Leaderboard** (chủ bản chuẩn; muốn sửa thì gửi đề xuất cho LB, đừng sửa riêng ở đây): `pre-commit`
    và `pre-push` (trừ commit/push chỉ `.md`). Commit từ GitHub Desktop/IDE cũng qua khoá: `hook-env.sh` tìm node/pnpm
    khi PATH của app GUI thiếu. Shell đã giữ khoá **phải** `export CC_HEAVY_OWNER='<đúng dòng owner>'` trong cùng
    lệnh với `git commit`/`git push`, nếu không hook chờ chính khoá của mình tới `CC_HEAVY_WAIT_MAX` (mặc định 30 phút)
    rồi fail, không chạy gì. Hook bị huỷ (Ctrl-C) hoặc kill (TERM/HUP) tự nhả khoá, chỉ khi dòng owner vẫn là của nó;
    bị SIGKILL thì khoá kẹt lại — kiểm dòng owner rồi mới gỡ tay. Vì hook chờ khoá và chờ RAM trống ≥ 35% trên macOS/Linux, ≥ 21% trên Windows (WSL vmmem +
    nén bộ nhớ giữ sẵn nhiều RAM; ghi đè bằng `CC_HEAVY_MIN_FREE_PCT`), một `git commit` có thể đứng chờ lâu: đọc dòng `heavy-lock: waiting`.
- Chạy hẹp trước: `node --test scripts/lib/slug.test.mjs` (một file). Full suite chỉ khi đụng contract dùng chung.
- **Đừng chép số đo vào file này.** Số test và thời gian chạy đổi theo từng commit; muốn biết thì chạy và đọc output.

### Soi comment TRƯỚC KHI commit (bắt buộc)

Đọc lại diff của mọi file sắp commit và **xoá comment vô dụng**. Agent sinh code có thói
quen để lại nhật ký công việc trong comment; thứ đó lẫn vào codebase là nợ vĩnh viễn.

Xoá:

- **Work log / lịch sử**: "Phase 04 sẽ dùng", "bản trước dùng X, nay đổi sang Y", "theo
  yêu cầu của red-team", "đã sửa lỗi ...". Git history giữ việc này, comment thì không.
- **Diễn giải lại code**: `// tăng i lên 1`, `// gán tên cho biến name`. Comment chỉ nói
  thứ code KHÔNG nói được.
- **Tham chiếu plan/phase/audit** dưới mọi hình thức.
- **Comment chết**: nói về code đã bị xoá hoặc đã đổi.
- **TODO không chủ**: `// TODO: xem lại` không ai nhận thì xoá hoặc mở việc thật.
- **Link/đường dẫn không có trên git**: URL hay path trỏ tới thứ git không track — `plans/`, `secrets/`
  (đều gitignore), report cục bộ, đường dẫn máy cá nhân. Người chỉ có repo không mở được; trỏ tới ADR/doc đã
  commit, hoặc nói thẳng lý do ngay trong comment.

Giữ:

- **VÌ SAO** chọn cách này, nhất là khi cách hiển nhiên hơn lại sai.
- **Invariant** phải đúng để code chạy, và hậu quả nếu vi phạm.
- **Cạm bẫy đã đo được**: hành vi lạ của thư viện/hệ điều hành, kèm bằng chứng.
- Tham chiếu **ADR** (ADR ổn định, plan thì không).

## 6. Git, commit, hook

- **Repo này CÓ `.github/workflows/`** (deploy GitHub Pages + các nút CMS qua `workflow_dispatch`) — khác JudgeHub. Workflow chỉ chạy trên `main`.
- **`.husky/pre-commit`**: chặn khi staged > 50 file; chặn file nguồn > 1000 dòng mà commit làm dài thêm; commit **chỉ `.md` → bỏ qua check**; còn lại: `pnpm format:fix` (re-stage file đã format, không nuốt phần chưa stage) → `pnpm check` → `pnpm lint` → `pnpm test`. Giữ khoá nặng `/tmp/cc-heavy.lock` (§5).
- **`.husky/pre-push`**: `pnpm format:check` → `pnpm check` → `pnpm lint` → `pnpm test` → `pnpm build`; push chỉ `.md` bỏ qua.
- **`.husky/commit-msg`**: chặn "Claude/Anthropic/Codex/ChatGPT" (cho phép nhắc `CLAUDE.md`).
- `git commit`/`git push` có thể vượt trần thời gian của lệnh Bash tiền cảnh → chạy bằng cơ chế chạy nền của harness (`run_in_background`), ghi output ra file để đọc lỗi hook. Log từng bước ở `.git/hook-logs/`.
- **KHÔNG chạy test/lint/typecheck "để kiểm tra lần cuối" ngay trước khi commit/push** — hook đã chạy đúng những thứ đó. Vẫn chạy test hẹp trong lúc code, hoặc khi chẩn đoán lỗi hook.
- Commit theo conventional commits, không nhắc AI. Không đưa plan ID, số phase, nhãn audit vào comment code, tên test hay commit message — mô tả thẳng hành vi/invariant.
- Hai cổng bắt buộc trước mỗi commit nằm ở mục khác: soi comment (§5) và review đa góc nhìn (§9).

## 7. Chính tả tiếng Việt thống nhất

Dấu đặt theo kiểu `oá/oè/uỷ`: **Xoá, khoá, Huỷ** (cùng quy tắc: hoà, thoả, tuỳ). Không dùng Xóa/khóa/Hủy trong UI, locale hay docs.

## 8. Đặt tên file & tài liệu

File trong `plans/`, `reports/` theo format `yyyyMMdd-hhmm <topic>.md` (hoặc thư mục kebab-case cho plan). `plans/` bị gitignore. Quyết định kiến trúc/sản phẩm bền vững → `docs/`.

## 9. Chạy agent

Áp cho orchestrator điều phối subagent, và cho chính subagent. Ràng buộc tài nguyên khi
chạy song song nằm ở §5 (test là khe CPU độc quyền).

### Nhiều agent review TRƯỚC KHI commit (bắt buộc)

Không commit một diff mà mới chỉ có chính người viết ra nó đọc lại. Trước **mỗi** commit
có thay đổi code, chạy **ít nhất 2 agent review đọc-thuần, mỗi agent một góc nhìn khác
nhau**. Wave lớn, hoặc diff chạm file đang phục vụ production, thì 3–4.

**Vì sao nhiều góc nhìn thay vì một reviewer kỹ hơn**: một lượt review giỏi một loại lỗi
và mù loại còn lại. Đo được ở wave 3 của plan answer-only: reviewer bắt được lỗi cờ "đã
giải rồi" đặt phạm vi theo _problem_ trong khi bí mật nó canh là theo _biến thể_ — nghĩa
là student luyện tập trước sẽ mở khoá đáp án contest. Lỗi đó nằm ngay trong hợp đồng,
không phải ở rìa, và **toàn bộ test đều xanh**. Cùng wave đó có hai test _khẳng định
chính hành vi rò_. Nên: **test xanh không phải bằng chứng hành vi đúng.**

Bốn góc nhìn mặc định — cắt theo loại lỗi, không cắt theo thư mục:

- **Hồi quy**: đường code cũ có đổi hành vi không. Bắt buộc khi một refactor được khai là
  "thuần" — đối chiếu từng lời gọi giữa bản cũ và bản mới.
- **Rò dữ liệu / zero-trust**: bí mật nào đi tới được payload của student, RBAC, phạm vi
  của mọi cờ "được phép xem".
- **Toàn vẹn dữ liệu**: điểm, bảng tổng hợp, đua ghi, ranh giới giao dịch. Đặc biệt là
  chỗ hai nguồn số có thể lệch nhau **âm thầm**.
- **Biên tập + chất lượng test**: comment thừa, DRY, lớp kiểm tra trùng — và test có
  chứng minh đúng điều nó khai không, hay chỉ assert vào mock của chính nó.

Luật vận hành:

- Reviewer **read-only** ⇒ chạy song song an toàn (§5: song song chỉ an toàn khi không
  cùng ghi). Không giao quyền sửa code cho reviewer.
- **Orchestrator thẩm định lại trước khi sửa.** Reviewer có thể sai, hoặc vừa đọc một
  bản đã cũ. Đừng sửa theo một phát hiện chưa tự kiểm.
- Verdict FIX-FIRST ⇒ sửa hết rồi mới commit; sửa xong chạy lại test hẹp + `typecheck`.
- Khi một phát hiện mâu thuẫn với yêu cầu trong plan, thường là **hai caller khác nhau**
  chứ không phải một bên sai — tách theo caller trước khi bỏ một bên.

### Nhịp cập nhật khi chạy nhiều agent

Spawn nhiều agent implement thì phải giữ hai nhịp, không được để dồn tới cuối:

- **Xong MỖI agent → cập nhật ngay plan status** (đánh dấu phase/bước đã xong, ghi phát
  hiện lệch so với plan). Agent sau đọc plan để biết đang ở đâu; plan cũ = agent sau làm
  trùng hoặc làm sai giả định.
- **Xong MỖI wave → commit.** Wave = nhóm agent chạy song song cùng đợt. Commit khi cả
  wave đã xong và cây làm việc sạch, trước khi spawn wave kế. Để dồn nhiều wave rồi
  commit một lần sẽ vượt trần số file của hook và mất điểm quay lui khi wave sau hỏng.
- Chỉ orchestrator (hoặc git-manager) chạy git ghi; agent implement chỉ được git đọc.
  Không spawn git-manager khi còn agent đang chạy — chung một working tree.

**Giữ agent trong tầm kiểm soát:**

- Giao **danh sách file được sửa** tường minh. Agent phát hiện phải sửa file ngoài danh
  sách thì **báo về orchestrator rồi dừng**, không tự mở rộng phạm vi.
- **Orchestrator là người quyết**, không đẩy lên user. Orchestrator mở rộng phạm vi cho
  agent đó, giao sang phase/agent khác, hoặc ghi vào plan để làm sau. Chỉ hỏi user khi
  chạm quyết định sản phẩm hoặc thứ khó đảo ngược.
- Agent báo cáo lệch so với plan chứ không tự ứng biến kiến trúc.
- Reviewer/red-team phải neo mỗi phát hiện vào `file:line` + kịch bản hỏng **có thật**.
  Bỏ qua phát hiện dạng "về lý thuyết có thể" mà không chỉ ra được đường đi tới nó —
  over-thinking ca không xảy ra được làm loãng đúng thứ cần sửa.

### Xét theo TOÀN pipeline, không xét hàm đơn lẻ

Một hàm tách rời thì gần như luôn có đường hỏng. Nhưng nó không sống một mình. Câu hỏi
đúng không phải _"hàm này có thể nhận đầu vào xấu không"_ mà **"đầu vào xấu có đi tới
được đây không, sau khi qua mọi cổng phía trước"**.

Trước khi báo một lỗi hoặc thêm một lớp kiểm tra, **truy ngược lên**: Zod parse ở biên,
guard RBAC, route nginx, ràng buộc DB, hook, kiểu dữ liệu. Nếu một cổng phía trước đã
chặn ca đó thì **không phải phát hiện, và không cần thêm kiểm tra** — chỉ là code phải
bảo trì thêm.

Ba ngoại lệ được phép trùng lớp, phải nói rõ lý do khi làm:

- **Ranh giới tin cậy đổi chủ** — dữ liệu đi qua mạng sang service khác; bên nhận không
  được tin bên gửi đã lọc.
- **Fail-closed cho an toàn** — rò dữ liệu, RBAC, tiền, điểm số. Sai một lần là mất, lớp
  thừa rẻ hơn lỗ hổng.
- **Invariant compiler không giữ được** — cột JSONB đọc ra thực chất là `any`.

Luật này áp cho cả ba vai: reviewer bỏ phát hiện đã bị chặn, implementer không thêm kiểm
tra thừa, và người viết plan không đẻ requirement phòng ca không tới được.
