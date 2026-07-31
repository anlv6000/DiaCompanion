// Nhãn tiếng Việt cho các mã enum trả từ backend.
// Chỉ mục 0 để trống nếu enum bắt đầu từ 1, cho khớp giá trị số.

export const metricTypes = {
  1: { label: "Đường huyết", unit: "mmol/L", short: "Glucose" },
  2: { label: "HbA1c", unit: "%", short: "HbA1c" },
  3: { label: "Huyết áp tâm thu", unit: "mmHg", short: "HA trên" },
  4: { label: "Huyết áp tâm trương", unit: "mmHg", short: "HA dưới" },
};

export const metricContexts = {
  1: "Trước ăn",
  2: "Sau ăn",
  3: "Trước khi ngủ",
};

export const symptomSeverities = {
  1: { label: "Nhẹ", kind: "ok" },
  2: { label: "Vừa", kind: "warn" },
  3: { label: "Nặng", kind: "alert" },
};

export const medicationStatuses = {
  0: { label: "Chờ uống", kind: "warn" },
  1: { label: "Đã uống", kind: "ok" },
  2: { label: "Bỏ lỡ", kind: "alert" },
  3: { label: "Đã hủy", kind: "muted" },
};

export const referralTypes = {
  0: "Không cần chuyển",
  1: "Tái khám định kỳ",
  2: "Chuyển chuyên khoa mắt",
  3: "Chuyển khẩn cấp",
};

export const notificationTypes = {
  1: { label: "Tái khám", icon: "calendar-outline" },
  2: { label: "Thuốc", icon: "medkit-outline" },
  3: { label: "Kết quả", icon: "document-text-outline" },
  4: { label: "Chỉ số", icon: "pulse-outline" },
  5: { label: "Bài viết", icon: "book-outline" },
};

export const blogCategories = {
  1: "Kiến thức",
  2: "Dinh dưỡng",
  3: "Cảnh báo",
};

// Lựa chọn loại chỉ số khi nhập (dropdown).
export const metricTypeOptions = [
  { value: 1, label: "Đường huyết", unit: "mmol/L" },
  { value: 2, label: "HbA1c", unit: "%" },
  { value: 3, label: "Huyết áp tâm thu", unit: "mmHg" },
  { value: 4, label: "Huyết áp tâm trương", unit: "mmHg" },
];

export const contextOptions = [
  { value: 1, label: "Trước ăn" },
  { value: 2, label: "Sau ăn" },
  { value: 3, label: "Trước khi ngủ" },
];

export const severityOptions = [
  { value: 1, label: "Nhẹ" },
  { value: 2, label: "Vừa" },
  { value: 3, label: "Nặng" },
];
