import type { Role } from "@/types/api";

/**
 * Bản đồ quyền phía client, KHỚP với [Authorize(Roles=...)] ở backend.
 * Dùng để ẩn/hiện nút — KHÔNG thay cho kiểm tra ở server (server vẫn là chốt
 * chặn thật). Mục đích: đừng cho người dùng bấm nút chắc chắn sẽ bị 403.
 *
 * Quan trọng: một số thao tác void CHỈ dành cho Bác sĩ, Admin không được:
 *  - void lượt khám, void đơn thuốc, void review  → chỉ Doctor
 *  - void hồ sơ BN, void ảnh, void kết quả AI      → Doctor hoặc Admin
 */
export const can = {
  // Duyệt / ghi đè kết quả AI — chỉ Bác sĩ (đặt FinalGrade là hành vi lâm sàng).
  reviewDiagnosis: (r?: Role) => r === "Doctor",

  // Void theo từng loại đối tượng.
  voidPatient: (r?: Role) => r === "Doctor" || r === "Admin",
  // Void lượt khám — Bác sĩ + Lễ tân (lễ tân hủy lượt tạo nhầm ở quầy).
  // LƯU Ý: backend đang [Authorize(DoctorOnly)] cho /visits/{id}/void.
  // Cần mở thành nhóm gồm Receptionist để lễ tân dùng được (xem hướng dẫn BE).
  voidVisit: (r?: Role) => r === "Doctor" || r === "Receptionist",
  voidImage: (r?: Role) => r === "Doctor" || r === "Admin",
  voidDiagnosis: (r?: Role) => r === "Doctor" || r === "Admin",
  voidPrescription: (r?: Role) => r === "Doctor",
  voidReview: (r?: Role) => r === "Doctor",

  // Đóng lượt khám (nhập kết luận) — hành vi lâm sàng, CHỈ Bác sĩ.
  // Backend: PUT /api/visits/{id}/close [Authorize(Roles = DoctorOnly)].
  closeVisit: (r?: Role) => r === "Doctor",

  // Kê đơn / kiểm chất lượng ảnh / nạp ảnh — nhân viên lâm sàng.
  prescribe: (r?: Role) => r === "Doctor",
  manageImages: (r?: Role) => r === "Doctor" || r === "Nurse" || r === "Admin",

  // Cấp lại mật khẩu bệnh nhân — lễ tân (khâu đầu quầy).
  // Backend đã mở reissue-credentials cho FrontDesk.
  reissuePatientCredential: (r?: Role) =>
    r === "Doctor" || r === "Nurse" || r === "Admin" || r === "Receptionist",

  // Nghiệp vụ lễ tân: tạo hồ sơ bệnh nhân + mở lượt khám.
  // Backend GIỜ giới hạn hai việc này ở CHỈ Receptionist.
  createPatient: (r?: Role) => r === "Receptionist",
  createVisit: (r?: Role) => r === "Receptionist",

  // Xếp lịch ca trực bác sĩ — lễ tân, admin giám sát.
  manageShifts: (r?: Role) => r === "Receptionist" || r === "Admin",

  // Xem danh sách tái tầm soát — nhân viên (thay cho lịch khám cũ).
  viewRecheck: (r?: Role) =>
    r === "Doctor" || r === "Nurse" || r === "Admin" || r === "Receptionist",
};

/**
 * Trang chủ an toàn cho mỗi vai trò khi đăng nhập (điểm chốt phía client).
 *
 * Web console KHÔNG có route "/home" (đó là màn của app bệnh nhân, MOB-03). Nếu
 * backend trả defaultRoute = "/home" cho lễ tân, hoặc trả rỗng, thì phải quy về
 * một route THẬT mà vai trò đó có quyền vào — nếu không sẽ rơi vào màn trắng
 * hoặc bị RequireAuth chặn.
 *
 * Mỗi đích dưới đây đều tồn tại trong routes.tsx và vai trò tương ứng có quyền:
 *  - Doctor       → /triage       (SCR-14, phân loại)
 *  - Admin        → /dashboard    (SCR-19)
 *  - Nurse        → /patients     (SCR-06)
 *  - Receptionist → /reception/visits/new (quầy tiếp đón)
 */
export function homeRouteFor(role?: Role): string {
  switch (role) {
    case "Doctor":
      return "/triage";
    case "Admin":
      return "/dashboard";
    case "Nurse":
      return "/patients";
    case "Receptionist":
      return "/reception/visits/new";
    default:
      return "/login";
  }
}

/**
 * Chọn route đích sau đăng nhập: ưu tiên defaultRoute của backend NHƯNG chỉ khi
 * nó là route web hợp lệ. Nếu backend trả "/home" (không có trên web) hoặc rỗng,
 * quay về trang chủ an toàn theo vai trò.
 */
export function resolveLandingRoute(role?: Role, defaultRoute?: string): string {
  if (defaultRoute && defaultRoute !== "/home") return defaultRoute;
  return homeRouteFor(role);
}
