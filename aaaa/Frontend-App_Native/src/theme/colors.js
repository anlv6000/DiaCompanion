// Bảng màu dùng chung, khớp với console web để hai bên đồng bộ nhận diện.
export const colors = {
  canvas: "#F7F8FA",
  surface: "#FFFFFF",
  hairline: "#E2E5EA",
  ink: "#1A1D23",
  muted: "#5A6270",
  faint: "#8A909C",

  primary: "#0E7C86",
  primaryActive: "#0A5E66",
  primarySoft: "#E3F1F2",

  defer: "#5A4FCF",
  deferSoft: "#ECEAFB",

  ok: "#1B7F5A",
  okSoft: "#E3F3EC",
  warn: "#B26A00",
  warnSoft: "#FBF0DD",
  alert: "#B10026",
  alertSoft: "#FBE3E7",

  // Thang màu 5 mức võng mạc ĐTĐ (không → tăng sinh), khớp web.
  grade: ["#54687A", "#FED976", "#FD8D3C", "#E9522A", "#B10026"],

  white: "#FFFFFF",
  shadow: "rgba(20,23,28,0.08)",
};

// Nhãn 5 mức DR
export const gradeLabels = [
  "Không bệnh (R0)",
  "Nhẹ (R1)",
  "Vừa (R2)",
  "Nặng (R3)",
  "Tăng sinh (R4)",
];
