/**
 * Cấu hình tập trung. Mọi nơi cần địa chỉ backend đều import API_BASE từ đây,
 * không đọc window trực tiếp và không hardcode URL rải rác.
 *
 * Giá trị lấy từ window.__DIACOMPANION_API__ (đặt trong public/config.js) để
 * đổi được lúc deploy mà không cần build lại.
 */
declare global {
  interface Window {
    __DIACOMPANION_API__?: string;
  }
}

const DEFAULT_API = "https://diacompanion.io.vn";

export const API_BASE: string = (
   DEFAULT_API
).replace(/\/$/, "");

/** Khoá lưu phiên trong sessionStorage. */
export const STORAGE_KEYS = {
  token: "diacompanion.token",
  user: "diacompanion.user",
} as const;

/** Trang mặc định sau đăng nhập nếu backend không chỉ định defaultRoute. */
export const DEFAULT_ROUTE = "/triage";

export {};
