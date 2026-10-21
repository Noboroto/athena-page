# Hướng dẫn viết bài

Dành cho người viết nội dung. Không cần tài khoản GitHub. Mọi thao tác ở https://editor.athena.noboroto.id.vn; bài lưu xong sẽ tự lên https://athena.noboroto.id.vn sau vài phút.

## 1. Đăng nhập

1. Admin mời email của bạn (xem [Vận hành CMS](cms-operations.md#4-mời-người-viết)). Email mời có thể rơi vào Spam.
2. Mở trang editor, chọn một trong hai cách:
   - **Email**: nhập địa chỉ đã được mời, nhận mã 6 số qua email (mã hết hạn sau 5 phút), nhập mã.
   - **Google**: bấm đăng nhập Google, dùng đúng tài khoản Google có email đã được mời (Google chỉ hoạt động khi admin đã bật).
3. Email chưa được mời sẽ bị từ chối.

Trong CMS có các mục: **Tin tức (VI)**, **News (EN)**, **Dự án (VI)**, **Projects (EN)**, **Papers**, **Thành viên**, **Cài đặt site** và **Mẫu bài** (chỉ admin sửa).

## 2. Tạo bài mới từ mẫu

1. Mở collection cần tạo (ví dụ Tin tức (VI)), bấm nút **Tạo từ mẫu**.
2. Chọn mẫu, nhập tiêu đề (tên paper, họ tên thành viên, tên dự án), xác nhận. Chờ khoảng một phút, tải lại danh sách: bài mới xuất hiện ở trạng thái **Nháp**.
3. Mở bài, điền các chỗ `[[…]]` (ví dụ `[[Họ tên]]`). Mẫu cho từng loại nằm ở `templates/`, quy ước chi tiết ở [templates/README.md](../templates/README.md).
4. Khi mọi ô đã điền, **tắt công tắc Nháp** rồi lưu.

Không dùng nút "New entry" cho News (EN) và Projects (EN): hai collection này không cho tạo mới, bản tiếng Anh chỉ sinh bằng nút ở mục 5.

Nút khác ở một bài đang mở:

- **Nhân bản**: sao chép bài (tin, dự án, paper, thành viên) thành bài mới với tiêu đề bạn nhập, giữ nguyên nội dung để sửa tiếp.

### Soạn ngoài CMS rồi nhập file `.md`

1. Thành viên: ở danh sách Thành viên, bấm **Templates** (trên điện thoại chỉ hiện biểu tượng tải xuống) và chọn mẫu để tải file `.md` về. Loại nội dung khác: mở một bài có sẵn, menu **⋮**, **Download**.
2. Soạn file trên máy (giữ nguyên các khoá frontmatter, quy ước `[[…]]` như mục 3).
3. Trong CMS bấm **Add an entry** (bài mới) hoặc mở bài cần thay, rồi bấm nút **Import from file** (biểu tượng tải lên) và chọn file. Các ô được điền sẵn; chưa có gì được lưu.
4. Kiểm tra lại các ô (ô sai kiểu bị báo đỏ khi lưu), rồi bấm **Save**. Bài mới lấy tên file theo mẫu của collection (ví dụ ngày + tiêu đề), không theo tên file bạn chọn.

**Mỗi người là một bài riêng.** Thêm thành viên mới bằng **Tạo từ mẫu**, **Add an entry** hoặc **Import from file** trên bài mới. Ô **Họ tên** chỉ nhập được lúc tạo; sau đó bị khoá vì tên quyết định đường dẫn trang (`/members/<tên-file>/`), là thứ mọi tin, paper, dự án dùng để trỏ tới người đó. Ảnh và các ô khác vẫn sửa bình thường. Hai người trùng tên (hoặc chỉ khác dấu) vẫn có hai trang riêng: bài sau tự được thêm số vào tên file (`le-van-tam-1` khi tạo bằng Add an entry, `le-van-tam-2` khi dùng Tạo từ mẫu / Nhân bản). **Import from file** vào một thành viên đã có không đổi được Họ tên.

### Paper từ BibTeX

1. Ở danh sách Papers bấm **Tạo từ BibTeX**, dán **một** mục BibTeX (`@inproceedings{…}`, `@article{…}`…), xác nhận.
2. Khoảng một phút sau, tải lại danh sách: paper mới ở trạng thái **Nháp**. Tiêu đề, tác giả, ngày (năm + tháng nếu có), nơi đăng, loại, DOI/arXiv/URL, từ khoá và tóm tắt được điền từ BibTeX; ô BibTeX giữ nguyên bản bạn dán.
3. Tác giả trùng tên một thành viên (đúng dấu, họ trước hay tên trước đều được) được nối với trang thành viên đó. BibTeX viết không dấu chỉ được nối khi không có hai thành viên cùng tên không dấu (ví dụ "Lê Văn Tâm" và "Lê Văn Tám"); trường hợp đó, và tác giả ngoài nhóm, giữ tên như trong BibTeX. Kiểm tra lại danh sách tác giả, nơi đăng (thêm tên viết tắt nếu muốn), loại paper và dự án liên quan.
4. Sửa xong, **tắt Nháp** rồi lưu.

Tóm tắt giữ nguyên công thức `$…$` để site hiển thị bằng KaTeX. Preprint arXiv xuất từ Google Scholar hoặc DBLP (`@article` với `arXiv preprint …` hay `CoRR`) được ghi là preprint, nơi đăng "arXiv". "and others" trong danh sách tác giả bị bỏ.

BibTeX lỗi cú pháp, thiếu `title`, `author` hoặc năm (`year`, hoặc `date` kiểu biblatex), hay có nhiều hơn một mục thì không tạo gì; lý do ghi ở lần chạy workflow "Paper from BibTeX" (admin xem trong tab Actions của repo).

## 3. Nháp, placeholder và bài bị cách ly

- **Nháp** (`draft`) mặc định bật với bài mới. Bài nháp không hiện ở bất cứ đâu trên site, kể cả RSS, sitemap và tìm kiếm.
- Chỉ có `draft` quyết định bài có hiện hay không. Ngày đăng ở tương lai không ẩn bài.
- **Bài không nháp mà còn `[[…]]`** (kể cả dạng `\[\[…` do editor tự thêm dấu `\`), có link ảnh/thành viên/dự án/paper không tồn tại, hoặc tên file không phải chữ thường–số–gạch ngang sẽ bị **cách ly**: không lên site, các bài khác vẫn lên bình thường. Hệ thống tự mở một issue có nhãn `deploy-attention` trên GitHub liệt kê file và lỗi. Sửa bài rồi lưu lại, lần deploy sau issue tự đóng.
- Bài không nháp chỉ được trỏ tới thành viên, dự án, paper **đã xuất bản** (không phải nháp). Trỏ tới bản nháp cũng bị coi là link hỏng.
- **Thành viên có Họ tên không còn khớp tên file** (bỏ dấu; ví dụ file `le-thu-ha.md` mà tên là "Lê Thanh Tùng") cũng bị cách ly: Họ tên bị khoá trong CMS, nên lệch nghĩa là hồ sơ một người khác đã được gõ đè lên bài này. Sửa bài đó về đúng người cũ rồi tạo bài mới cho người mới. Nếu một người thật sự đổi tên, báo admin: admin đổi tên file trên GitHub và sửa các bài đang trỏ tới tên cũ.
- Lỗi nặng hơn (frontmatter hỏng, thiếu trường bắt buộc, giá trị sai kiểu) làm build thất bại: site cũ được giữ nguyên và admin nhận cùng loại issue. Báo admin nếu thấy.
- Nếu CMS báo "File has changed…" thì tải lại trang rồi sửa lại; có người khác vừa lưu bài này.

## 4. Công thức toán và Source mode

Công thức viết `$…$` (cùng dòng) hoặc `$$…$$` (khối riêng). Editor rich-text tự thêm dấu `\` trước `_`, `[`, `]` và dấu nháy ngược, làm hỏng công thức và `[[…]]`. Vì vậy:

- Viết hoặc dán công thức ở **chế độ Source** (nút chuyển ở góc ô Nội dung).
- Đã viết ở Source thì **không mở lại bài bằng chế độ soạn thảo thường** rồi lưu; hãy tiếp tục sửa ở Source.
- Ví dụ: `$\mathcal{O}(n\log n)$` hiển thị bằng KaTeX khi site build.
- HTML thô như `<script>` bị lọc; link `javascript:` bị chặn ở các ô URL.

## 5. Bản tiếng Anh

Site mặc định tiếng Việt; tiếng Anh là tuỳ chọn và **chỉ Tin tức và Dự án có bản en**. Papers và Thành viên dùng chung một bản (thành viên có thêm `Chức danh (EN)` và `Giới thiệu (EN)`).

1. **Lưu bài tiếng Việt trước.**
2. Mở bài, bấm **Tạo bản tiếng Anh**, xác nhận. Một bản nháp cùng tên file xuất hiện trong News (EN) hoặc Projects (EN).
3. Mở bản en, dịch nội dung và tiêu đề, tắt Nháp, lưu.

Tên file hai bản phải trùng nhau để site ghép cặp; vì vậy không tạo tay trong collection en. Bài chỉ có một bản (chưa dịch, hoặc bản kia còn nháp) vẫn hiện trong danh sách của ngôn ngữ còn lại, kèm nhãn "Chỉ có bản tiếng Việt/Anh" và link sang trang của bản đang có; RSS của ngôn ngữ thiếu bản thì không đăng bài đó. Giới thiệu thành viên cũng vậy: thiếu bản của ngôn ngữ đang xem thì hiện bản kia kèm nhãn. Chỉ khi có đủ hai bản, hai trang mới được khai báo là bản dịch của nhau (hreflang, sitemap).

Giới hạn: bài quá dài (khoảng trên 65.000 ký tự) làm nút **Nhân bản** và **Tạo bản tiếng Anh** thất bại; báo admin.

## 6. Ảnh

- Tải ảnh qua trường ảnh của bài (bìa, đại diện). Định dạng: jpg, jpeg, png, webp. Ảnh nằm ở `public/images/<members|news|projects|papers>/`.
- **Ảnh đại diện thành viên**: dùng ảnh vuông. Sau khi **lưu bài**, mở thư viện ảnh **Ảnh thành viên** và bấm **Tối ưu ảnh**. Hệ thống chuyển mọi ảnh jpg/jpeg/png đang được dùng làm `avatar` thành WebP 400×400 (cắt vuông, ưu tiên vùng nổi bật), sửa dòng `avatar:` trong bài và deploy lại. Ảnh gốc được xoá, trừ khi còn bài khác tham chiếu.
- Nút chỉ xử lý ảnh đang là `avatar` của thành viên. Ảnh tin tức, dự án, paper giữ nguyên như đã tải.
- Chưa lưu bài mà bấm nút thì ảnh chưa được tham chiếu và sẽ không được xử lý.

## 7. Các loại nội dung và nơi hiển thị

| Loại         | Quy ước                                                                                            | Hiển thị                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Tin tức      | Tên file `năm-tháng-ngày-tiêu-đề` do CMS đặt; chọn `Loại`; `Người viết` và `Thành viên liên quan`  | `/news/`, 5 tin mới nhất ở trang chủ, trang cá nhân của thành viên được gắn, RSS `/rss.xml` |
| Dự án        | Trạng thái `Đang thực hiện` hoặc `Đã hoàn thành`; `Thứ tự` nhỏ lên trước                           | `/projects/`; dự án đang thực hiện ở trang chủ; trang cá nhân thành viên tham gia           |
| Papers       | `Tác giả`: tên file thành viên không có `.md` (ví dụ `nguyen-van-a`), người ngoài nhóm nhập họ tên | `/papers/`; paper bật **Nổi bật** ở trang chủ; trang cá nhân tác giả; RSS `/papers/rss.xml` |
| Thành viên   | Chọn `Vai trò`; tốt nghiệp thì đổi `Tình trạng` thành `Cựu thành viên` (nhóm Alumni)               | `/members/` theo vai trò; mỗi người một trang cá nhân tự gom paper, dự án, tin liên quan    |
| Cài đặt site | Tên nhóm, khẩu hiệu, giới thiệu, email, liên kết (VI/EN)                                           | Tên nhóm, giới thiệu, email liên hệ trên các trang                                          |

Bản en tương ứng nằm dưới `/en/…` và RSS `/en/rss.xml`. Tìm kiếm ở `/search/`.

Nhận thành viên mới: admin mời email vào CMS ([Vận hành CMS](cms-operations.md#4-mời-người-viết)), người đó tạo trang thành viên từ mẫu (Giảng viên, Nghiên cứu sinh, Học viên cao học, Sinh viên). Nên trỏ `Người viết` của tin và `Tác giả` của paper về đúng tên file thành viên để trang cá nhân tự gom bài.

## 8. Khi gặp sự cố

| Hiện tượng                                     | Việc cần làm                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| Không nhận được mã đăng nhập                   | Kiểm Spam, chờ vài phút, thử Google, báo admin                              |
| Bài đã lưu nhưng chưa lên site sau 10 phút     | Xem issue `deploy-attention` hoặc báo admin; có thể bài bị cách ly (mục 3)  |
| Công thức hiện `\_` hoặc chữ `\[\[`            | Mở ở Source mode và xoá dấu `\` thừa (mục 4)                                |
| Nút (Tạo từ mẫu, Nhân bản…) không thấy bài mới | Chờ khoảng một phút rồi tải lại; vẫn không có thì báo admin kèm giờ bấm nút |
