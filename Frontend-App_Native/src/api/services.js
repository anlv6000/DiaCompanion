import { http, query } from "./client";

/**
 * Toàn bộ endpoint mà BỆNH NHÂN được phép gọi, gom theo nhóm nghiệp vụ.
 * Mỗi hàm chỉ dựng URL + method; không xử lý state ở đây.
 * Tên và tham số bám sát controller backend.
 */

// Xác thực — bệnh nhân đăng nhập bằng SỐ ĐIỆN THOẠI.
export const authApi = {
  loginPassword: (phone, password) => http.post("/api/auth/login", { phone, password }),
  requestOtp: (phone) => http.post("/api/auth/request-otp", { phone }),
  loginOtp: (phone, code) => http.post("/api/auth/login-otp", { phone, code }),
  forgotPassword: (phone) => http.post("/api/auth/forgot-password", { phone }),
  resetPassword: (phone, code, newPassword) =>
    http.post("/api/auth/reset-password", { phone, code, newPassword }),
  // First login: chỉ gửi newPassword; backend dựa vào MustChangePassword
  // để cho phép đổi mật khẩu tạm mà không yêu cầu currentPassword.
  changePassword: (currentPassword, newPassword) =>
    http.post("/api/auth/change-password", {
      ...(currentPassword ? { currentPassword } : {}),
      newPassword,
    }),
  changeFirstPassword: (newPassword) =>
    http.post("/api/auth/change-password", { newPassword }),
  logout: () => http.post("/api/auth/logout"),
  me: () => http.get("/api/auth/me"),
};

// Hồ sơ bản thân.
export const profileApi = {
  me: () => http.get("/api/patients/me"),
  updateMine: (body) => http.put("/api/patients/me", body),
  requestPhoneChangeOtp: (newPhone) =>
    http.post("/api/patients/me/phone/request-otp", { newPhone }),
  confirmPhoneChange: (newPhone, code, rowVersion) =>
    http.post("/api/patients/me/phone/confirm", { newPhone, code, rowVersion }),
};

// Chỉ số sức khỏe (glucose, HbA1c, huyết áp).
export const metricsApi = {
  list: (params) => http.get("/api/monitoring/metrics" + query(params)),
  create: (body) => http.post("/api/monitoring/metrics", body),
  update: (id, body) => http.put(`/api/monitoring/metrics/${id}`, body),
  // rowVersion đi qua query string, không qua body — xem ghi chú ở http.del.
  // pairRowVersion dùng cho huyết áp: một lần đo là hai dòng (tâm thu, tâm trương).
  remove: (id, rowVersion, pairRowVersion) =>
    http.del(
      `/api/monitoring/metrics/${id}` + query({ rowVersion, pairRowVersion }),
    ),
  summary: (patientId, days) =>
    http.get(`/api/monitoring/metrics/summary/${patientId}` + query({ days })),
};

// Nhật ký lối sống (ăn uống + vận động).
export const lifestyleApi = {
  list: (days) => http.get("/api/monitoring/lifestyle" + query({ days })),
  create: (body) => http.post("/api/monitoring/lifestyle", body),
  update: (id, body) => http.put(`/api/monitoring/lifestyle/${id}`, body),
  remove: (id, rowVersion) =>
    http.del(`/api/monitoring/lifestyle/${id}` + query({ rowVersion })),
};

// Thuốc hôm nay.
export const medicationApi = {
  today: () => http.get("/api/monitoring/medications/today"),
  setStatus: (id, status, rowVersion) =>
    http.put(`/api/monitoring/medications/${id}/status`, { status, rowVersion }),
};

// Tái tầm soát (ngày tái khám kế tiếp).
export const recheckApi = {
  mine: () => http.get("/api/recheck/me"),
};

// Lịch sử lượt khám CỦA BỆNH NHÂN. Backend có endpoint riêng /me để bệnh nhân
// chỉ thấy lượt khám của chính mình (endpoint /api/visits gốc là cho nhân viên).
export const visitsApi = {
  list: (params) => http.get("/api/visits/me" + query(params)),
  get: (id) => http.get(`/api/visits/me/${id}`),
};

// Diễn tiến bệnh (biểu đồ DR + fractal + HbA1c của bản thân).
export const progressionApi = {
  mine: (months) =>
    http.get("/api/diagnoses/progression/me" + query({ months })),
};

// Triệu chứng.
export const symptomApi = {
  report: (body) => http.post("/api/engagement/symptoms", body),
  list: (params) => http.get("/api/engagement/symptoms" + query(params)),
};

// Thông báo.
export const notificationApi = {
  list: (params) => http.get("/api/engagement/notifications" + query(params)),
  unreadCount: () => http.get("/api/engagement/notifications/unread-count"),
  markRead: (id) => http.put(`/api/engagement/notifications/${id}/read`),
  markAllRead: () => http.put("/api/engagement/notifications/read-all"),
};

// Blog sức khỏe (đọc bài đã xuất bản — không cần đăng nhập nhưng vẫn đính token nếu có).
export const blogApi = {
  published: (params) => http.get("/api/blog/published" + query(params)),
  get: (id) => http.get(`/api/blog/${id}`),
};

// Phản hồi lượt khám đã hoàn tất.
export const feedbackApi = {
  create: (body) => http.post("/api/engagement/feedback", body),
};
