# Mẫu bài viết

Thư mục này chứa mẫu cho nút "Tạo từ mẫu" trong CMS. File ở đây **không** lên site và **không** phải bài thật.

## Quy ước placeholder

- Chỗ cần điền viết dạng `[[Mô tả]]`.
- Trong frontmatter (YAML) **luôn đặt trong nháy kép**: `title: "[[Họ tên]] bảo vệ…"`. Xoá nháy thì YAML hiểu thành mảng và bài hỏng.
- Mọi mẫu có `draft: true`. Điền xong tất cả `[[…]]` rồi mới đổi sang `draft: false`.
- Không có ngoại lệ: còn `[[` hoặc `\[\[` (editor tự thêm dấu `\`) ở bất kỳ đâu trong bài không nháp thì `check-content` báo lỗi. Local build thất bại; trên CI bài đó bị cách ly (không lên site) và admin nhận issue.
- Tham chiếu (`author`, `members`, `projects`) dùng slug (tên file không đuôi `.md`) của thành viên/dự án đã tồn tại.

## Danh sách

| Mẫu                                              | Thư mục                        |
| ------------------------------------------------ | ------------------------------ |
| Tin tức (9 loại, vi và en)                       | `news/vi/`, `news/en/`         |
| Dự án                                            | `projects/vi/`, `projects/en/` |
| Paper (hội nghị, tạp chí)                        | `papers/`                      |
| Thành viên (giảng viên, NCS, thạc sĩ, sinh viên) | `members/`                     |
