// Định dạng ngày giờ, số — dùng chung toàn app. Hiển thị theo giờ Việt Nam.

const VN = "vi-VN";
const TZ = "Asia/Ho_Chi_Minh";

export function fmtDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  const opts = withTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }
    : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ };
  return new Intl.DateTimeFormat(VN, opts).format(d);
}

export function fmtTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(VN, { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
}

// "DueDate" backend trả dạng DateOnly "2026-03-15" — hiển thị gọn.
export function fmtDateOnly(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return fmtDate(value);
  return `${d}/${m}/${y}`;
}

export function num(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (isNaN(n)) return "—";
  return n.toLocaleString(VN, { maximumFractionDigits: digits });
}

export function pct(value) {
  if (value === null || value === undefined) return "—";
  return Math.round(Number(value) * 100) + "%";
}

// Ngày hôm nay dạng YYYY-MM-DD theo giờ VN (để gửi LogLocalDate).
export function localToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return parts; // en-CA cho ra "2026-03-15"
}
