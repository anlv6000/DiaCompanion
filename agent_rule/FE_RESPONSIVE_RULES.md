# FE_RESPONSIVE_RULES.md — Responsive cho web console

Ca dùng thật cần hỗ trợ: **bác sĩ mở web console trên điện thoại để xử lý nhanh** — xem hàng đợi, đọc kết luận, duyệt kết quả AI, ký nhận. Không phải để nhập liệu dài.

Web console **không thay thế** app bệnh nhân. Đừng biến nó thành app.

---

## 1. Breakpoint

`app.css` hiện có 7 mốc rời rạc: 1180, 1050, 900, 820, 760, 680, 520. Mỗi lập trình viên thêm một mốc theo cảm tính, kết quả là hành vi không đoán được và sửa chỗ này vỡ chỗ kia.

**Rút về ba mốc, không thêm mốc mới:**

| Tên | Ngưỡng | Thiết bị điển hình |
|---|---|---|
| `lg` | ≥ 1180px | Màn hình bàn làm việc, laptop |
| `md` | 700–1179px | Tablet, cửa sổ hẹp |
| `sm` | < 700px | Điện thoại |

Viết mobile-first: quy tắc gốc là cho `sm`, dùng `min-width` để mở rộng lên. Nếu buộc phải giữ `max-width` cho hợp code cũ thì cũng chỉ dùng đúng hai ngưỡng: `max-width: 1179px` và `max-width: 699px`.

---

## 2. Khung ứng dụng

| Vùng | `lg` | `md` | `sm` |
|---|---|---|---|
| `.app` | lưới `210px 1fr` | lưới `180px 1fr` | một cột |
| `.side` | cố định | cố định, hẹp hơn | **ngăn kéo trượt**, mặc định ẩn |
| `.top` | cao 54px | 54px | 52px, dính đỉnh |
| `.content` | padding 24px | 16px | 12px |
| `.rail` | `1fr 360px` | một cột, phụ xuống dưới | một cột |
| `.grid2` `.grid3` | như tên | `grid2` giữ, `grid3` thành 2 cột | một cột |

Ở `sm`: nút mở menu nằm bên trái `.top`. Ngăn kéo phủ toàn màn, có nền mờ, đóng bằng bấm nền hoặc `Esc`. Chuyển trang thì tự đóng.

---

## 3. Bảng trên điện thoại — vấn đề khó nhất

Bảng 8 cột không vừa màn 390px. Chọn **một** trong hai chiến lược cho mỗi bảng, ghi rõ chọn cái nào:

**Chiến lược A — Cuộn ngang, cột đầu dính.**
Giữ nguyên cấu trúc bảng, `.table-wrap` cuộn ngang, cột định danh (tên hoặc mã bệnh nhân) `position: sticky; left: 0`. Dùng cho bảng cần so sánh nhiều số liệu.

**Chiến lược B — Đổ thành danh sách thẻ.**
Mỗi dòng thành một thẻ: định danh in đậm trên cùng, các trường còn lại xếp dọc dạng nhãn–giá trị, hành động ở đáy. Dùng cho bảng mà người dùng chỉ chọn một dòng để mở chi tiết — tức phần lớn worklist.

**Không được** thu nhỏ chữ xuống dưới 13px để nhét vừa bảng. Chữ 10px trên điện thoại là không đọc được, và đó là dữ liệu lâm sàng.

**Không được** ẩn cột mà không cho cách xem lại. Nếu ẩn, phải mở được ở trang chi tiết.

---

## 4. Vùng chạm và thao tác

1. Mọi phần tử bấm được ≥ 44×44px ở `sm`. Nút `sm` 30px trong bảng phải nâng lên 44px trên điện thoại.
2. Khoảng cách giữa hai vùng chạm ≥ 8px.
3. Không dựa vào hover. Mọi thông tin hiện khi hover (tooltip, nút ẩn trong dòng) phải có đường khác trên cảm ứng.
4. Cụm nút trong `.toolbar` xếp dọc, mỗi nút rộng hết hàng khi quá 2 nút.
5. Ô nhập trên điện thoại cỡ chữ ≥ 16px — dưới 16px iOS tự phóng to trang, gây nhảy layout.
6. Chọn đúng bàn phím: `inputMode="numeric"` cho số đo, `type="tel"` cho điện thoại, `type="date"` cho ngày.

---

## 5. Ưu tiên theo màn hình

Bác sĩ trên điện thoại cần bốn việc. Bốn màn này phải hoàn hảo ở `sm`:

1. **Hàng đợi phân loại** — xem ca chờ, mở nhanh
2. **Chi tiết lượt khám** — đọc kết luận, chỉ số, tiền sử
3. **Duyệt kết quả AI** — xem ảnh, xem mức DR, đồng ý hoặc ghi đè
4. **Đóng lượt khám** — nhập kết luận ngắn, chọn chu kỳ tái khám

Các màn còn lại (quản trị người dùng, quản lý mô hình, thống kê, báo cáo in) chỉ cần **không vỡ layout**. Được phép hiện thông báo "Màn hình này nên dùng trên máy tính" kèm liên kết quay lại.

---

## 6. Xem ảnh đáy mắt trên điện thoại

- Ảnh chiếm toàn bộ chiều rộng, nền `--fundus`.
- Thanh công cụ nổi ở đáy, không phải trên đỉnh — ngón cái với tới được.
- Hỗ trợ chụm để phóng. Không chặn cử chỉ mặc định của trình duyệt.
- So sánh hai mắt: xếp dọc ở `sm`, cạnh nhau từ `md` trở lên.
- Nút "Đồng ý" và "Ghi đè" luôn nhìn thấy, không nằm sau thao tác cuộn.

---

## 7. Những thứ không đổi theo màn hình

Để tránh sửa quá tay:

- Bảng màu, thang mức DR, ý nghĩa badge — giống hệt nhau ở mọi kích thước.
- Nhãn nút — không viết tắt trên điện thoại. "Thu hồi" vẫn là "Thu hồi", không thành "TH".
- Thứ tự cột và thứ tự trường — giữ nguyên để người dùng chuyển thiết bị không phải học lại.
- Số chữ số thập phân của chỉ số lâm sàng.

---

## 8. Kiểm thử tối thiểu

Trước khi coi một trang là xong, mở ở bốn kích thước: **1440**, **1180**, **820**, **390**. Ở mỗi mức kiểm ba việc:

1. Không có thanh cuộn ngang ở cấp trang (cuộn ngang chỉ được phép bên trong `.table-wrap`)
2. Không có chữ nào bị cắt hoặc đè lên nhau
3. Mọi nút hành động chính đều với tới được, không bị che

Test thêm với **dữ liệu xấu nhất**: tên bệnh nhân 200 ký tự, kết luận 2000 ký tự, lý do thu hồi 500 ký tự, danh sách rỗng, và lỗi mạng.
