# FE_FIX_CHECKLIST.md — Checklist rà file FE

Chạy checklist này cho **mỗi file** trong `Frontend/src/` khi sửa. Báo cáo theo đúng thứ tự mục, ghi rõ dòng số.

Quy trình: **đọc file → đối chiếu checklist → báo cáo phát hiện → chờ duyệt → mới sửa.**
Không sửa trước khi báo cáo.

---

## A. Tràn chữ và đè chữ

- [ ] Có `height` cố định trên thùng chứa có chữ người dùng nhập không? → đổi sang `min-height`
- [ ] Ô bảng chứa văn bản có bị `white-space: nowrap` không? → phân loại lại theo bảng cột ở `FE_DESIGN_RULES.md` mục 3.1
- [ ] Con của flex/grid có chữ đã có `min-width: 0` chưa?
- [ ] Trường có thể chứa chuỗi dài không khoảng trắng (email, mã, tên file) đã có `overflow-wrap: anywhere` chưa?
- [ ] Chỗ nào cắt chữ bằng ellipsis mà thiếu `title` đầy đủ?
- [ ] Badge, pill, chip có bị đặt `width` cứng không?
- [ ] Card trong lưới có kẹp số dòng để đều nhau chưa?
- [ ] Bảng đã bọc `.table-wrap` chưa?

## B. Mật độ và khoảng trống

- [ ] Ở 1440px, nội dung có lấp được 60% chiều rộng không? Nếu không, xử lý theo thứ tự ưu tiên mục 4 (R9)
- [ ] Cỡ chữ có theo thang ở mục 2 không? Có chỗ nào dưới 12px không?
- [ ] Bảng có `width: 100%` chưa?
- [ ] Trang form có kẹp `max-width: 720px` chưa?
- [ ] Khoảng cách có theo nhịp 4px không?
- [ ] Trong một panel có quá 3 cỡ chữ không?

## C. Nút

- [ ] Có đúng một nút primary trong mỗi panel/modal không?
- [ ] Nút danger có đứng cạnh nút primary không? → tách ra
- [ ] Nhãn nút có phải động từ cụ thể không? Có nút nào ghi "OK", "Gửi", "Xác nhận" trống nghĩa không?
- [ ] Nút chỉ có icon đã có `aria-label` và `title` chưa?
- [ ] Trạng thái đang xử lý đã khoá nút và đổi nhãn chưa?
- [ ] Nút bị vô hiệu có giải thích lý do không?
- [ ] Kích thước nút có đúng thang sm/md/lg không?

## D. Bảng

- [ ] Đủ bốn trạng thái: đang tải, rỗng, lỗi, có dữ liệu?
- [ ] Trạng thái rỗng có câu gợi ý hành động, hay chỉ ghi "Không có dữ liệu"?
- [ ] `th` đã sticky khi cuộn dọc chưa?
- [ ] Quá 8 cột không?
- [ ] Cột hành động có nằm cuối và canh phải không?
- [ ] Số liệu đã dùng `.mono` với `tabular-nums` chưa?

## E. Modal và thông báo

- [ ] Modal đúng loại và đúng chiều rộng (420 / 560 / lớn)?
- [ ] `max-height: 85vh`, cuộn nằm trong thân modal?
- [ ] Tiêu đề bắt đầu bằng động từ?
- [ ] Modal huỷ dữ liệu có nêu hậu quả cụ thể không?
- [ ] Thao tác thu hồi có bắt nhập lý do ở FE trước khi gọi API không?
- [ ] `Esc` xử lý đúng (đóng modal thường, không đóng modal huỷ dữ liệu)?
- [ ] Toast lỗi có tự tắt không? → phải giữ lại
- [ ] Lỗi trường có hiện dưới trường bằng `.field-error` không, hay chỉ có toast?

## F. Responsive

- [ ] Breakpoint có nằm ngoài ba mốc chuẩn (1180 / 700) không?
- [ ] Bảng đã chọn chiến lược A hay B cho `sm`? Ghi rõ.
- [ ] Vùng chạm ≥ 44px ở `sm` chưa?
- [ ] Ô nhập ≥ 16px chưa (tránh iOS tự phóng)?
- [ ] Có chức năng nào chỉ dùng được qua hover không?
- [ ] Đã thử ở 1440 / 1180 / 820 / 390 chưa?

## G. Khớp dữ liệu backend

- [ ] Tên trường có khớp DTO backend không? (đã từng sai vì DTO lồng nhau: `glucose.average`, `hba1c.latest.value`, `bloodPressure.latest.systolic`)
- [ ] Giá trị enum có khớp `Common/Enums.cs` không? Không tự đặt số.
- [ ] Thao tác sửa/void có gửi kèm `rowVersion` không?
- [ ] Dữ liệu liên quan có gộp một request không? (huyết áp gộp một lần)
- [ ] Endpoint có đúng vai trò không? (bệnh nhân dùng `/api/visits/me`, nhân viên dùng `/api/visits`)

## H. An toàn lâm sàng

- [ ] Trạng thái có được truyền tải chỉ bằng màu không? → phải kèm chữ
- [ ] Chỉ số bất thường có đánh dấu rõ ràng không?
- [ ] Số có bị làm tròn sai số chữ số thập phân so với backend không?
- [ ] Ngày giờ hiển thị theo giờ địa phương hay UTC? (backend lưu UTC, có `RecordedLocalDate` riêng — không tự chuyển đổi lung tung)
- [ ] Hành động không thể hoàn tác có xác nhận không?

---

## Mẫu báo cáo

```
FILE: src/pages/DoctorVisitsPage.tsx

[A] Tràn chữ
- Dòng 214: cột "Kết luận" đang nowrap, trường này tối đa 2000 ký tự → đè cột hành động
- Dòng 189: .visit-header là flex, con chứa tên bệnh nhân thiếu min-width: 0

[C] Nút
- Dòng 302: hai nút primary cạnh nhau ("Lưu" và "Đóng lượt khám")
- Dòng 318: nút "Thu hồi" (danger) đứng ngay cạnh "Lưu" (primary)

[F] Responsive
- Chưa chọn chiến lược bảng cho sm; ở 390px tràn ngang toàn trang

ĐỀ XUẤT: sửa A trước (gây lỗi hiển thị dữ liệu), C sau, F cuối.
Chờ duyệt trước khi sửa.
```
