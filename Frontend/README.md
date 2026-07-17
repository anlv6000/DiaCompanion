# DiaCompanion — Web (clinical console)

Console lâm sàng (bác sĩ/admin) cho hệ thống sàng lọc võng mạc đái tháo đường.
React + Vite + TypeScript + Tailwind, dữ liệu lấy từ backend .NET đã tạo.
Giao diện tuân theo `DESIGN.md` (IBM Plex, teal, hairline, thang DR colorblind-safe,
badge deferral) — chống "AI-slop".

## 1. Chạy (web)

```bash
npm install
npm run dev        # http://localhost:5173
```

Cần backend .NET chạy ở `http://localhost:5080` (xem repo backend). Đăng nhập:
`an.doctor@diacompanion.local` / `Password123!` (bác sĩ) hoặc
`admin@diacompanion.local` / `Password123!` (admin).

> Backend đã bật CORS cho phép mọi origin ở môi trường dev, nên gọi từ 5173 sang 5080 chạy được.
> Đổi địa chỉ backend qua biến môi trường: tạo `.env` với `VITE_API_BASE=http://localhost:5080`.

## 2. Build production

```bash
npm run build      # ra thư mục dist/
npm run preview    # xem thử bản build
```

## 3. Đóng gói Electron (tùy chọn)

```bash
npm i -D electron
npm run build
npx electron electron/main.cjs
```

App dùng `HashRouter` nên chạy được cả web lẫn khi load từ `file://` trong Electron
mà không cần sửa gì. Fonts self-host (offline OK).

## 4. Kiến trúc dữ liệu (theo yêu cầu)

Quy tắc: **mọi dữ liệu từ backend đi qua `DataContext` trước; page gọi `DataContext`;
component chỉ nhận props và KHÔNG tự fetch.**

```
src/
  config/api.ts          # baseAPI + bảng route API (tách riêng như yêu cầu)
  lib/apiClient.ts        # fetch wrapper, gắn Bearer token
  contexts/
    AuthContext.tsx       # đăng nhập, token (in-memory), role, hasRole()
    DataContext.tsx       # NƠI DUY NHẤT gọi backend: loaders + actions + state
  routes.tsx              # bảng route trung tâm + guard auth/role
  components/             # THUẦN trình bày (props only) — không gọi context data
    AppShell.tsx          # nav + top bar (chỉ dùng AuthContext)
    clinical.tsx          # GradeChip, DeferBadge, ReferableTag, MeterBar, DataState
    charts.tsx            # RiskCoverageChart, ProgressionChart
    ui/primitives.tsx     # Button/Badge/Panel/Input… restyle theo token
  pages/                  # gọi useData()/useAuth(), đọc state, truyền xuống component
  styles/tokens.css       # biến CSS = nguồn chân lý token (khớp DESIGN.md)
  types/models.ts         # kiểu TS khớp DTO backend (camelCase)
```

Luồng: `Page → useData().loadX()` → `DataContext` gọi `apiClient` → lưu vào state của
`DataContext` → page đọc state, truyền props cho component trình bày. Component không
bao giờ import `apiClient` hay gọi loader.

## 5. Map trang → Use Case → endpoint

| Trang | UC | Endpoint (qua DataContext) |
|---|---|---|
| Login | UC-01 | `POST /api/auth/login` |
| Triage (mặc định) | UC-12 | `GET /api/aidiagnosis/triage` |
| Detail rail: Phê duyệt/Ghi đè | UC-15 | `POST /api/reviews/{id}` |
| Bệnh nhân | UC-05 | `GET /api/patients?q=&diabetesType=` |
| Hồ sơ bệnh án | UC-06 | `GET /api/patients/{id}` |
| Diễn tiến | UC-13 | `GET /api/aidiagnosis/progression/{patientId}` |
| Ca mâu thuẫn (Admin) | UC-19 | `GET /api/reviews/conflicts` |
| Thống kê | UC-28 | `GET /api/dashboard/stats` |
| Cấu hình (Admin) | UC-03 | `GET/PUT /api/adminconfig/configs`, `/models` |

## 6. Ghi chú

- Bảng Triage hiển thị **mã ảnh (`#fundusImageId`)** làm định danh ca, vì endpoint
  `/triage` trả về `AiDiagnosis` chưa kèm tên bệnh nhân. Nếu muốn hiện tên BN trên
  hàng đợi, cần bổ sung join ở backend (thêm PatientId/FullName vào response `triage`).
- Token giữ **in-memory** theo `AGENTS.md` → refresh trang sẽ về màn đăng nhập.
- `POST /api/aidiagnosis/run/{id}` đã có sẵn trong `DataContext.runAi` để nối màn
  fundus viewer (bước 4) — viewer ảnh + overlay tổn thương là phần chưa dựng ở scaffold này.
```
