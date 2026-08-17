# FE_DESIGN_RULES.md — Hệ thiết kế web console DiaCompanion

Phạm vi: `Frontend/src/` (React + TS + Vite, CSS thuần trong `src/styles/app.css`).
Người dùng: bác sĩ, lễ tân, quản trị viên — dùng nhiều giờ mỗi ngày, trên màn hình bệnh viện và đôi khi trên điện thoại.

**Định hướng:** *clinical dense* — dày dữ liệu, đọc nhanh, không trang trí. Không gradient, không bo góc lớn, không đổ bóng nhiều lớp, không icon minh hoạ. Mọi pixel phải mang thông tin.

---

## 1. Token màu

Đã định nghĩa trong `:root` của `app.css`. **Không hardcode mã màu ở bất kỳ đâu khác.**

```
--canvas    #f7f8fa   nền trang
--surface   #fff      nền panel, bảng, modal
--hairline  #e2e5ea   mọi đường kẻ, viền
--ink       #1a1d23   chữ chính
--muted     #5a6270   chữ phụ, vẫn đọc được
--faint     #8a909c   nhãn, chú thích, metadata
--primary   #0e7c86   hành động chính, trạng thái đang chọn
--alert     #c0362c   nguy hiểm, bất thường
--watch     #b77800   cảnh báo, cần theo dõi
--ok        #1b7f5a   bình thường, thành công
--defer     #5a4fcf   chuyển bác sĩ xử lý (Gap 2)
--g0..--g4            thang mức DR, tuần tự, không đổi thứ tự
```

**Quy tắc màu**

1. Thang `--g0` → `--g4` là thang **thứ bậc**. Không dùng chúng cho mục đích khác, không đảo thứ tự, không chèn màu mới vào giữa.
2. Màu **không bao giờ** là kênh thông tin duy nhất. Mỗi trạng thái phải kèm chữ hoặc ký hiệu. Có bác sĩ mù màu.
3. Chữ trên nền màu phải đạt tương phản ≥ 4.5:1. Badge nền nhạt thì chữ dùng màu đậm cùng tông, không dùng trắng.
4. Chỉ `--primary` được dùng cho hành động. Không tô `--primary` lên chữ trang trí hay tiêu đề.

---

## 2. Thang chữ

Nền tảng hiện tại **quá nhỏ** cho màn hình bệnh viện. Thang chuẩn mới:

| Vai trò | Cỡ | Trọng lượng | Font | Dùng ở đâu |
|---|---|---|---|---|
| Tiêu đề trang | 26px | 600 | Serif | `.title h1`, một cái duy nhất mỗi trang |
| Tiêu đề panel | 15px | 600 | Serif | `.panel-h` |
| Body | 15px | 400 | Sans | văn bản thường, `body` |
| Ô bảng | 13.5px | 400 | Sans | `td` |
| Đầu cột bảng | 11px | 600 | Sans | `th`, viết hoa, letter-spacing 0.05em |
| Nhãn trường | 11px | 600 | Sans | `.field label`, viết hoa |
| Chú thích | 12px | 400 | Sans | `.small`, `.hint` |
| Số liệu, mã | kế thừa | 500 | **Mono** | mọi chỉ số lâm sàng, mã BN, ngày giờ |

**Quy tắc chữ**

1. Mọi số lâm sàng, mã hồ sơ, ngày giờ dùng `.mono` (đã có `font-variant-numeric: tabular-nums`). Số không thẳng cột là số khó so sánh.
2. Tối đa **3 cỡ chữ** trong một panel. Nhiều hơn là dấu hiệu phân cấp sai.
3. Không dùng cỡ chữ để nhấn mạnh. Dùng trọng lượng (600) hoặc màu (`--ink` so với `--muted`).
4. Chiều cao dòng: 1.5 cho đoạn văn, 1.35 cho ô bảng, 1.2 cho tiêu đề.
5. Không viết hoa toàn bộ đoạn văn tiếng Việt — dấu thanh làm chữ hoa khó đọc. Chỉ viết hoa nhãn ngắn dưới 3 từ.

---

## 3. Tràn chữ — nhóm rule quan trọng nhất

Nguyên nhân gốc của lỗi đè chữ hiện tại nằm ở ba chỗ trong `app.css`:

```css
td { height: 34px; white-space: nowrap; }   /* chiều cao cứng + cấm xuống dòng */
th { white-space: nowrap; }
.panel-h { height: 38px; }                   /* chiều cao cứng */
```

Chiều cao cố định cộng với cấm xuống dòng thì chữ dài bắt buộc phải tràn ra ngoài và đè lên phần tử bên cạnh.

### 3.1 Quy tắc bắt buộc

**R1 — Không đặt `height` cố định lên bất kỳ thùng chứa nào có chữ do người dùng nhập.**
Dùng `min-height` cộng `padding`. Áp dụng cho `td`, `.panel-h`, `.navlink`, `.duty-card`, `.metric-card`, `.notif-item`, `.detail-item`.

**R2 — Mặc định của ô bảng là xuống dòng, không phải nowrap.**
Phân loại cột rõ ràng:

| Loại cột | Hành vi | Ví dụ |
|---|---|---|
| Cột văn bản | `white-space: normal`, xuống dòng tự do | Họ tên, kết luận, ghi chú, địa chỉ, lý do |
| Cột nguyên khối | `white-space: nowrap` | Mã BN, ngày giờ, badge, số đo |
| Cột số | `nowrap`, canh phải, `tabular-nums` | Tuổi, HbA1c, huyết áp |
| Cột hành động | `nowrap`, canh phải, luôn cuối bảng | Nút Xem/Sửa |

**R3 — Mọi con của flex hoặc grid chứa chữ phải có `min-width: 0`.**
Đây là nguyên nhân đè chữ phổ biến nhất mà không ai ngờ tới: con của flex mặc định `min-width: auto`, tức không bao giờ co nhỏ hơn nội dung, nên nó tràn ra ngoài thay vì xuống dòng. Repo đã làm đúng ở `.main` và `.content` — phải làm nốt cho `.title`, `.toolbar`, `.panel-h`, `.kv`, `.detail-item`, `.top`, `.stat`.

**R4 — Chuỗi dài không có khoảng trắng phải cưỡng chế ngắt.**
Email, mã bệnh án, tên file ảnh, URL. Dùng `overflow-wrap: anywhere` — nếu không, một chuỗi 60 ký tự sẽ đẩy vỡ cả layout.

**R5 — Nếu buộc phải giữ một dòng, phải cắt bằng ellipsis kèm tooltip.**
`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` và **bắt buộc** kèm `title={fullText}`. Cắt chữ mà không cho cách xem đầy đủ là làm mất dữ liệu.

**R6 — Chữ nhiều dòng trong thẻ card thì kẹp số dòng, không cắt tuỳ ý.**
Dùng `-webkit-line-clamp: 2` (hoặc 3) để mọi card cùng cao mà không cắt giữa chữ.

**R7 — Badge, pill, chip phải co giãn được.**
Không đặt `width` cố định. Nhãn tiếng Việt dài gấp rưỡi tiếng Anh: "Chuyển khám chuyên khoa mắt" so với "Refer".

**R8 — Bảng phải có `.table-wrap` cuộn ngang.**
Đã có sẵn. Không được bỏ. Nhưng cuộn ngang là phương án cuối, không phải cách né việc thiết kế cột.

### 3.2 Trường dài cần chú ý riêng

Các trường trong DiaCompanion thực tế rất dài, phải cho xuống dòng:

- `Visit.Conclusion` (2000 ký tự) — không bao giờ để một dòng
- `VoidReason` (500 ký tự)
- `Patient.Address`, `Patient.Note`
- `Feedback.Comment`
- Nhãn mức DR tiếng Việt và lý do defer
- Tên bệnh nhân có thể tới 200 ký tự, tên người Việt hay dài

---

## 4. Mật độ và khoảng trống

Vấn đề đối lập: nhiều trang trống rỗng ở màn hình rộng.

**R9 — Ngưỡng lấp đầy.** Ở 1440×900, nội dung chính phải chiếm ít nhất 60% chiều rộng khung. Nếu không đạt, xử lý theo thứ tự ưu tiên:

1. Tăng cỡ chữ và chiều cao dòng theo thang mục 2 (dễ nhất, giúp đọc thật)
2. Thêm cột dữ liệu hữu ích vào bảng thay vì ẩn bớt
3. Chuyển sang bố cục `.rail` (nội dung chính + cột phụ 360px)
4. Kẹp chiều rộng bằng `max-width` và canh giữa — **chỉ dùng cho trang form và trang đọc**, không dùng cho worklist

**R10 — Bảng luôn chiếm hết chiều rộng khả dụng.** Bảng 6 cột thu vào giữa màn 27 inch là lãng phí. `width: 100%` cộng chiều rộng cột theo tỉ lệ.

**R11 — Trang form dùng `max-width: 720px`.** Dòng nhập dài hơn thế thì mắt phải quét ngang quá xa. Trống hai bên ở trang form là **đúng**, không phải lỗi.

**R12 — Nhịp khoảng cách 4px.** Chỉ dùng 4, 8, 12, 16, 24, 32. Không có 5px, 7px, 15px.

**R13 — Padding `.content` theo màn hình.** 24px ở màn rộng, 16px ở tablet, 12px ở điện thoại.

---

## 5. Nút

Hiện tại mọi nút cao 32px và chỉ có hai biến thể. Cần một hệ thống có chủ đích.

### 5.1 Kích thước

| Cỡ | Chiều cao | Dùng khi |
|---|---|---|
| `sm` | 30px | Trong ô bảng, trong toolbar dày |
| `md` | 36px | **Mặc định** — panel, form, modal |
| `lg` | 44px | Hành động chính của trang, nút trên điện thoại |

Trên điện thoại **mọi** nút tối thiểu 44×44px vùng chạm. Đây là ngưỡng an toàn, không phải khuyến nghị.

### 5.2 Loại nút theo ý nghĩa

| Loại | Hình thức | Quy tắc dùng |
|---|---|---|
| **Primary** | nền `--primary`, chữ trắng | Hành động chính. **Đúng một cái** mỗi panel hoặc modal |
| **Secondary** | nền `--surface`, viền `--hairline` | Hành động phụ. Không giới hạn số lượng |
| **Danger** | viền và chữ `--alert`, nền trắng | Thu hồi, huỷ, vô hiệu hoá. **Luôn** phải xác nhận |
| **Danger solid** | nền `--alert`, chữ trắng | Chỉ dùng cho nút xác nhận cuối trong modal huỷ |
| **Ghost** | không viền, chữ `--muted` | Đóng, bỏ qua, thao tác phụ trong bảng |
| **Link** | chữ `--primary`, gạch chân khi hover | Điều hướng, không phải hành động |

### 5.3 Quy tắc nút

1. Không đặt hai nút primary cạnh nhau. Nếu thấy hai, một trong hai là secondary.
2. Nút danger **không bao giờ** đứng cạnh nút primary trong cùng cụm — dễ bấm nhầm. Tách ra, hoặc đặt vào `.danger-zone`.
3. Nhãn nút là **động từ nói rõ chuyện gì xảy ra**: "Lưu chỉ số", "Thu hồi hồ sơ", "Đóng lượt khám". Không dùng "OK", "Gửi", "Xác nhận" trống nghĩa.
4. Nhãn giữ nguyên xuyên suốt: nút "Thu hồi" thì toast báo "Đã thu hồi".
5. Nút chỉ có icon phải có `aria-label` và `title`. Vùng chạm tối thiểu 32×32 trên desktop.
6. Trạng thái đang xử lý: khoá nút, đổi nhãn thành thể tiếp diễn ("Đang lưu…"). Không để người dùng bấm hai lần.
7. Nút bị vô hiệu phải giải thích được lý do — qua `title` hoặc dòng chữ cạnh bên. Nút xám không lý do là ngõ cụt.
8. `white-space: nowrap` giữ nguyên cho nút, nhưng nhãn phải ngắn. Nhãn dài quá 3 từ là dấu hiệu nên viết lại.

---

## 6. Panel và bảng

**R14 — `.panel-h` dùng `min-height: 38px`, không phải `height`.** Tiêu đề panel kèm nút hành động rất dễ tràn.

**R15 — Panel phải có tiêu đề nói rõ nội dung.** Không dùng tiêu đề chung chung như "Thông tin", "Chi tiết".

**R16 — Bảng quá 8 cột thì phải cắt.** Ưu tiên: giữ cột định danh và cột quyết định, đẩy phần còn lại vào trang chi tiết. Không nhồi 15 cột rồi bắt cuộn ngang.

**R17 — Đầu bảng dính khi cuộn dọc.** `position: sticky; top: 0` trên `th`. Bảng 50 dòng mà mất tiêu đề cột là không dùng được.

**R18 — Dòng bảng sọc nhẹ** bằng `--row`, và đổi nền khi hover. Mắt phải lần được theo hàng ngang.

**R19 — Mỗi bảng phải có đủ bốn trạng thái.** Đang tải (skeleton, không phải spinner giữa màn), rỗng (kèm câu gợi ý hành động), lỗi (nói rõ lỗi gì, có nút thử lại), và có dữ liệu. Trạng thái rỗng viết như lời mời làm việc: "Chưa có lượt khám nào hôm nay." chứ không phải "Không có dữ liệu".

---

## 7. Popup, modal, thông báo

### 7.1 Ba loại modal

| Loại | Chiều rộng | Dùng cho |
|---|---|---|
| **Xác nhận** | 420px | Hỏi có/không, thao tác huỷ, thu hồi |
| **Form** | 560px | Nhập liệu ngắn: tạo bệnh nhân, sửa hồ sơ |
| **Xem** | `min(1100px, 92vw)` | Ảnh đáy mắt, báo cáo, dữ liệu lớn |

### 7.2 Quy tắc modal

1. Chiều cao tối đa `85vh`. Cuộn nằm ở **thân modal**, không phải cả trang. Tiêu đề và cụm nút luôn nhìn thấy.
2. Cụm nút ở đáy, canh phải, thứ tự: phụ bên trái, chính bên phải. Trên điện thoại thì xếp dọc, nút chính lên trên.
3. Tiêu đề bắt đầu bằng động từ: "Thu hồi hồ sơ bệnh nhân", không phải "Thu hồi?".
4. Modal huỷ dữ liệu phải nêu **hậu quả cụ thể**, không nói chung chung: "Sẽ thu hồi 3 lượt khám và 5 ảnh đáy mắt kèm theo."
5. Thao tác thu hồi bắt buộc nhập lý do — backend đã yêu cầu, FE phải chặn trước để không phí một vòng gọi API.
6. Phím `Esc` đóng modal thường. Modal huỷ dữ liệu thì không đóng bằng `Esc` và không đóng khi bấm nền.
7. Bẫy tiêu điểm bàn phím trong modal. Đóng xong trả tiêu điểm về nút đã mở nó.
8. Không lồng modal trong modal. Cần bước tiếp thì thay nội dung trong cùng một modal.
9. Nền mờ dùng `rgba(0,0,0,0.4)`, không làm mờ blur — blur làm chậm máy cấu hình thấp trong bệnh viện.

### 7.3 Toast

- Thành công: 3 giây, tự tắt, góc trên phải.
- Lỗi: **không tự tắt**, phải có nút đóng. Người dùng cần thời gian đọc mã lỗi.
- Toast không bao giờ là nơi duy nhất báo lỗi form. Lỗi trường phải hiện ngay dưới trường đó bằng `.field-error`.
- Tối đa 3 toast cùng lúc, cái cũ nhất bị đẩy ra.

---

## 8. Nguyên mẫu trang

Mỗi trang thuộc đúng một loại. Cùng loại thì cùng bố cục.

**Worklist** — Tiêu đề + bộ lọc `.toolbar` + bảng + phân trang. Mặc định dày. Không tô điểm. Ví dụ: `TriagePage`, `PatientsPage`, `DoctorVisitsPage`.

**Chi tiết** — Tiêu đề kèm định danh + cụm hành động phải + bố cục `.rail` (nội dung chính trái, siêu dữ liệu phải). Ví dụ: `PatientDetailPage`.

**Form** — Kẹp 720px, canh giữa, một cột. Cụm nút dính đáy khi form dài. Ví dụ: trang tạo bệnh nhân.

**Báo cáo** — Tối ưu cho in. Serif, lề rộng, `@media print` phải hoạt động. Ví dụ: `VisitReportPage`.

**Xem ảnh** — Nền tối `--fundus`, thanh công cụ nổi, ảnh chiếm tối đa không gian. Ví dụ: `FundusPage`.

---

## 9. Chống rập khuôn AI

Không dùng: gradient tím, font Inter, bo góc 8px kèm đổ bóng nhiều lớp, ba cột đối xứng bằng nhau, icon emoji, chữ gradient, hiệu ứng glass, biểu tượng minh hoạ lớn.

Đã dùng: IBM Plex (Sans/Serif/Mono), đường kẻ hairline, bo góc 4–6px, không đổ bóng, tương phản tạo bằng khoảng trắng và trọng lượng chữ.

Điểm nhấn của sản phẩm này là **mật độ dữ liệu chính xác** — giống màn hình PACS, không giống trang giới thiệu SaaS.
