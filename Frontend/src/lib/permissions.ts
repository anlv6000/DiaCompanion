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
  voidVisit: (r?: Role) => r === "Doctor",
  voidImage: (r?: Role) => r === "Doctor" || r === "Admin",
  voidDiagnosis: (r?: Role) => r === "Doctor" || r === "Admin",
  voidPrescription: (r?: Role) => r === "Doctor",
  voidReview: (r?: Role) => r === "Doctor",

  // Kê đơn / kiểm chất lượng ảnh / nạp ảnh — nhân viên lâm sàng.
  prescribe: (r?: Role) => r === "Doctor",
  manageImages: (r?: Role) => r === "Doctor" || r === "Nurse" || r === "Admin",

  // Cấp lại mật khẩu bệnh nhân — nhân viên lâm sàng.
  reissuePatientCredential: (r?: Role) =>
    r === "Doctor" || r === "Nurse" || r === "Admin",
};
