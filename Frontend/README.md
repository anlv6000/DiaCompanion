# DiaCompanion — Web (clinical console) — bản hoàn chỉnh

Console lâm sàng (bác sĩ/admin) cho hệ thống sàng lọc võng mạc đái tháo đường.
React + Vite + TypeScript + Tailwind, dữ liệu qua `DataContext`, giao diện theo
`DESIGN.md`. Đã ghép **fundus viewer + overlay tổn thương**, token lưu **sessionStorage**,
và Electron chạy **server localhost ngầm** (không dùng `file://`).

## 1. Chạy web (dev)

```bash
npm install
npm run dev        # http://localhost:5173
```

Cần backend .NET ở `http://localhost:5080`. 

## 2. Chạy như app desktop (Electron, localhost ngầm)

```bash
npm install          # kéo cả electron (lần đầu ~vài chục MB)
npm run app          # = build + electron .
```

Electron KHÔNG load `file://`. Nó bật một HTTP server tĩnh phục vụ `dist/` ở
`http://localhost:9001` (nếu bận thì tự tăng 9002, 9003...) rồi mở cửa sổ trỏ vào đó —
routing/MIME/cache chuẩn như web thật, dễ tối ưu. Logic ở `electron/main.cjs`.

Chỉ chạy Electron sau khi đã có `dist/` (dùng `npm run app` là gọn nhất, nó build sẵn).

## 3. Đóng gói cài đặt (tùy chọn)

```bash
npm run dist         # electron-builder -> dist-electron/ (nsis/dmg/AppImage)
```

## 4. Kiến trúc dữ liệu (giữ nguyên nguyên tắc)

Mọi dữ liệu backend đi qua `DataContext` trước; page gọi `DataContext`;
component chỉ nhận props, không tự fetch. `baseAPI` nằm ở `src/config/api.ts`.

```
src/
  config/api.ts                # baseAPI + bảng route API
  lib/apiClient.ts             # fetch wrapper + bearer token
  contexts/
    AuthContext.tsx            # token sessionStorage (refresh giữ phiên; đóng hẳn trình duyệt mới mất)
    DataContext.tsx            # NƠI DUY NHẤT gọi backend
  routes.tsx                   # bảng route + guard auth/role
  components/
    AppShell.tsx               # nav + top bar
    FundusViewer.tsx           # viewer thuần props: zoom/pan + overlay + red-free
    lesions.ts                 # màu tổn thương Wong + mock generator + ảnh tổng hợp
    clinical.tsx, charts.tsx, ui/primitives.tsx
  pages/
    TriagePage.tsx             # worklist mặc định; nút "Xem ảnh đáy mắt" -> /fundus/:id
    FundusViewerPage.tsx       # gọi DataContext.runAi, hiển thị viewer
    PatientsPage.tsx, ProgressionPage.tsx, AdminPages.tsx, LoginPage.tsx
```

## 5. Fundus viewer

Mở từ Triage (chọn ca -> "Xem ảnh đáy mắt") hoặc trực tiếp `/#/fundus/{fundusImageId}`.
Có zoom/pan, red-free (lọc kênh xanh), overlay MA/HE/EX/SE bật/tắt riêng (màu Wong
colorblind-safe). Trang gọi `useData().runAi(id)` để lấy kết quả AI thật.

> Overlay hiện là marker placeholder sinh từ id ca, vì backend/model mock mới trả
> *số đếm* tổn thương (`lesionSummary`), chưa có mask theo pixel. Khi service Python
> trả mask thật: đổi lớp `<circle>` trong `FundusViewer.tsx` thành `<image>` mask PNG
> (hoặc `<polygon>`), phần zoom/pan/red-free giữ nguyên.

## 6. Ghi chú

- Router dùng `HashRouter` (URL có `#/`) -> chạy tốt cả web lẫn qua localhost server của Electron.
- Bảng Triage hiển thị `#fundusImageId` làm định danh ca (endpoint `/triage` chưa kèm
  tên bệnh nhân — muốn hiện tên cần thêm join ở backend).
