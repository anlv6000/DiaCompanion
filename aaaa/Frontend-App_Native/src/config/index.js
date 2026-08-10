import Constants from "expo-constants";

/**
 * Cấu hình tập trung. Địa chỉ backend lấy từ app.json (extra.apiBase) để đổi
 * khi build mà không sửa code rải rác.
 *
 * Lưu ý khi chạy thật trên điện thoại: "localhost" là chính cái điện thoại,
 * KHÔNG phải máy tính chạy backend. Khi test trên máy thật, đổi apiBase trong
 * app.json thành IP LAN của máy tính, ví dụ http://192.168.1.10:5080.
 */
const fromConfig = Constants.expoConfig?.extra?.apiBase;

export const API_BASE = ("https://localhost:55403").replace(/\/$/, "");

// Khoá lưu phiên trong AsyncStorage.
export const STORAGE_KEYS = {
  token: "diacompanion.token",
  user: "diacompanion.user",
};
