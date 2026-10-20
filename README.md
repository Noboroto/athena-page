# Athena Lab site

Site tĩnh song ngữ (vi mặc định, en tuỳ chọn) của nhóm nghiên cứu Athena: Papers, Projects, Tin tức, Thành viên.

- Site: https://athena.noboroto.id.vn (Astro, deploy GitHub Pages từ `main`)
- Soạn bài: https://editor.athena.noboroto.id.vn (Pages CMS tự host, người viết đăng nhập bằng email)
- Nội dung là Markdown trong `src/content/`; bài lỗi nội dung bị cách ly khi deploy và admin nhận issue `deploy-attention`.

## Phát triển

Cần Node 24 và pnpm (phiên bản ghim trong `package.json`).

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm check && pnpm lint && pnpm test && pnpm build
```

## Tài liệu

- [Hướng dẫn viết bài](docs/content-guide.md) – người viết
- [Vận hành CMS](docs/cms-operations.md) – admin
- [Triển khai và cấu trúc repo](docs/deployment.md) – developer
