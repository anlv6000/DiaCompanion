# DiaCompanion — Ứng dụng di động cho bệnh nhân

Ứng dụng di động (React Native + Expo) dành cho **bệnh nhân** trong hệ thống tầm
soát bệnh võng mạc đái tháo đường DiaCompanion. Bệnh nhân đăng nhập bằng **số điện
thoại**, tự theo dõi chỉ số sức khỏe, xem lịch tái khám và kết quả đã được bác sĩ
xác nhận.

> Đây là ứng dụng phía bệnh nhân, tách biệt với console web dành cho bác sĩ / điều
> dưỡng / quản trị viên. Ứng dụng chỉ gọi các endpoint mà backend cho phép vai trò
> `Patient` truy cập.

## Công nghệ

- **Expo SDK 51** + React Native 0.74 (JavaScript thuần, không TypeScript).
- **React Navigation** (bottom tabs + native stack) — điều hướng khai báo tường
  minh, dễ đọc.
- **react-native-svg** cho biểu đồ xu hướng.
- **AsyncStorage** lưu phiên đăng nhập.
- Không dùng thư viện state phức tạp: chỉ Context API + một hook `useAsync`.

## Cách chạy

```bash
# 1. Cài phụ thuộc
npm install

# 2. Mở địa chỉ backend cho đúng (xem mục dưới) rồi khởi động
npx expo start
```

Quét mã QR bằng ứng dụng **Expo Go** trên điện thoại, hoặc nhấn `a` (Android) /
`i` (iOS) để mở trình giả lập.

### ⚠️ Cấu hình địa chỉ backend (quan trọng)

Địa chỉ API nằm ở `app.json` → `expo.extra.apiBase`, mặc định
`http://localhost:5080`.

- Khi chạy trên **trình giả lập trên chính máy tính**: `localhost` dùng được.
- Khi chạy trên **điện thoại thật**: `localhost` là chính cái điện thoại, KHÔNG
  phải máy chạy backend. Phải đổi thành **IP LAN của máy tính**, ví dụ:

```json
"extra": { "apiBase": "http://192.168.1.10:5080" }
```

Điện thoại và máy tính phải cùng một mạng Wi-Fi. Tìm IP máy tính bằng `ipconfig`
(Windows) hoặc `ifconfig` / `ip addr` (macOS/Linux).

## Phụ thuộc backend

Ứng dụng gọi các API sau (đều thuộc vai trò `Patient` hoặc dùng chung):

| Nhóm | Endpoint chính |
|------|----------------|
| Xác thực | `POST /api/auth/login`, `request-otp`, `login-otp`, `forgot-password`, `reset-password`, `change-password`, `GET /api/auth/me` |
| Hồ sơ | `GET /api/patients/me`, `PUT /api/patients/me` (chỉ sửa địa chỉ) |
| Chỉ số | `GET/POST/PUT/DELETE /api/monitoring/metrics`, `GET /api/monitoring/metrics/summary/{patientId}` |
| Lối sống | `GET/POST/DELETE /api/monitoring/lifestyle` |
| Thuốc | `GET /api/monitoring/medications/today`, `PUT /api/monitoring/medications/{id}/taken` |
| Tái khám | `GET /api/recheck/me` |
| Diễn tiến | `GET /api/diagnoses/progression/{patientId}` |
| Triệu chứng | `POST/GET /api/engagement/symptoms` |
| Thông báo | `GET /api/engagement/notifications`, `unread-count`, `PUT .../read`, `read-all` |
| Blog | `GET /api/blog/published`, `GET /api/blog/{id}` |
| Phản hồi | `POST /api/engagement/feedback` |

**Lưu ý về OTP:** ở môi trường Development, backend trả `devCode` trong phản hồi
`request-otp` / `forgot-password` (không gửi SMS ở bản v1). Ứng dụng tự điền mã này
để tiện thử nghiệm. Bản triển khai thật cần cổng SMS.

## Kiến trúc

Ba tầng context, xếp trong `App.js`:

1. **AuthProvider** (`src/contexts/AuthContext.js`) — quản lý phiên đăng nhập.
   Quyết định hiện màn đăng nhập, màn buộc đổi mật khẩu tạm, hay ứng dụng chính.
   Khôi phục phiên khi mở lại app; tự đăng xuất khi token hết hạn (401).

2. **DataProvider** (`src/contexts/DataContext.js`) — **cửa duy nhất tới backend**.
   Mọi màn hình lấy dữ liệu qua `useData()`; không màn nào gọi thẳng
   `api/services`. Đây là nguyên tắc giống bên console web, giúp dễ kiểm soát và
   thay đổi tầng API một chỗ.

3. **ToastProvider** (`src/contexts/ToastContext.js`) — thông báo nhanh.

Tầng gọi HTTP (`src/api/client.js`) tự đính token, xử lý 401 tập trung, và ném
`ApiError` mang thông điệp tiếng Việt từ backend.

## Danh sách màn hình

```
Chưa đăng nhập
├─ LoginScreen            Đăng nhập bằng SĐT (mật khẩu hoặc OTP)
├─ ForgotPasswordScreen   Quên mật khẩu → OTP → đặt lại
└─ (buộc) ChangePassword  Đổi mật khẩu tạm lần đầu

Đã đăng nhập (5 tab + màn phụ)
├─ Tab: Home              Tổng quan: tái khám, thuốc hôm nay, lối tắt
├─ Tab: Metrics           Chỉ số + biểu đồ 30 ngày + thêm/sửa/xoá
├─ Tab: Medication        Thuốc hôm nay, đánh dấu đã uống (có hoàn tác)
├─ Tab: Progression       Biểu đồ diễn tiến DR + HbA1c (đã xác nhận)
├─ Tab: Profile           Hồ sơ, sửa địa chỉ, đổi mật khẩu, đăng xuất
├─ Recheck                Ngày tái tầm soát kế tiếp
├─ Lifestyle              Nhật ký ăn uống + vận động
├─ Symptoms               Báo triệu chứng + khuyến cáo tự động + trả lời BS
├─ Notifications          Thông báo, đánh dấu đã đọc
└─ Blog                   Bài viết sức khỏe đã xuất bản
```

## Cấu trúc thư mục

```
src/
├─ api/
│  ├─ client.js        Lớp gọi HTTP (token, 401, ApiError)
│  └─ services.js      Toàn bộ endpoint bệnh nhân, gom theo nhóm
├─ config/index.js     API_BASE, khoá lưu trữ
├─ contexts/           AuthContext, DataContext, ToastContext
├─ components/
│  ├─ ui.js            Button, Card, Field, Badge, GradeBadge, LoadState, Screen…
│  └─ MiniChart.js     Biểu đồ đường bằng SVG
├─ lib/
│  ├─ enums.js         Nhãn tiếng Việt cho enum backend
│  ├─ format.js        Định dạng ngày/giờ/số theo giờ VN
│  └─ hooks.js         useAsync
├─ screens/            13 màn hình
├─ theme/              colors.js, typography.js
└─ navigation.js       Cây điều hướng (auth / force-change / main)
```

## Ghi chú thiết kế

- **Xoá mềm:** dữ liệu bệnh nhân tự nhập (chỉ số, nhật ký) khi xoá chỉ được *ẩn*,
  không mất khỏi CSDL, để bác sĩ đối chiếu khi cần (khớp quy tắc backend).
- **Ngày địa phương:** mọi hiển thị và gom nhóm theo giờ Việt Nam
  (`Asia/Ho_Chi_Minh`), tránh lệch ngày do UTC.
- **Chỉ hiện kết quả đã xác nhận:** biểu đồ diễn tiến chỉ lấy mức DR bác sĩ đã
  duyệt, không hiện kết quả AI thô.
- **Bệnh nhân chỉ sửa địa chỉ:** tên, ngày sinh, loại đái tháo đường, số điện thoại
  do phòng khám quản lý.

## Giới hạn phiên bản

- Chưa gửi SMS thật cho OTP (dùng `devCode` ở môi trường Development).
- Chưa có push notification (chỉ kéo để làm mới).
- Biểu đồ dùng SVG tự vẽ, tối giản (đủ thể hiện xu hướng, không có tương tác zoom).
