import type { Role } from "@/types/api";

/**
 * Quyền hiển thị phía client, đồng bộ với mô hình 4 vai trò hiện tại.
 * Backend vẫn là lớp kiểm soát quyền cuối cùng.
 */
export const can = {
  reviewDiagnosis: (r?: Role) => r === "Doctor",

  // Thu hồi dữ liệu lâm sàng chỉ dành cho bác sĩ.
  voidPatient: (r?: Role) => r === "Doctor",
  voidVisit: (r?: Role) => r === "Doctor" || r === "Receptionist",
  voidImage: (r?: Role) => r === "Doctor",
  voidDiagnosis: (r?: Role) => r === "Doctor",
  voidPrescription: (r?: Role) => r === "Doctor",
  voidReview: (r?: Role) => r === "Doctor",

  closeVisit: (r?: Role) => r === "Doctor",
  prescribe: (r?: Role) => r === "Doctor",
  manageImages: (r?: Role) => r === "Doctor",

  // Cấp lại tài khoản tại quầy. Admin có API hỗ trợ nhưng không vào hồ sơ lâm sàng.
  reissuePatientCredential: (r?: Role) => r === "Receptionist",

  createPatient: (r?: Role) => r === "Receptionist",
  createVisit: (r?: Role) => r === "Receptionist",
  manageShifts: (r?: Role) => r === "Receptionist",
  viewRecheck: (r?: Role) => r === "Doctor" || r === "Receptionist",
};

/** Trang mặc định an toàn cho từng vai trò của web console. */
export function homeRouteFor(role?: Role): string {
  switch (role) {
    case "Doctor":
      return "/triage";
    case "Admin":
      return "/dashboard";
    case "Receptionist":
      return "/reception/visits/new";
    default:
      return "/login";
  }
}

export function resolveLandingRoute(role?: Role, defaultRoute?: string): string {
  if (defaultRoute && defaultRoute !== "/home") return defaultRoute;
  return homeRouteFor(role);
}
