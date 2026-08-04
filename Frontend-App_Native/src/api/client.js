import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, STORAGE_KEYS } from "../config";

/**
 * Lớp gọi HTTP mỏng cho toàn app.
 *
 * - Tự đính token Bearer vào mỗi request.
 * - Gặp 401 (token hết hạn) thì gọi hàm onUnauthorized để AuthContext đá về
 *   màn đăng nhập.
 * - Ném ApiError có message tiếng Việt từ backend để màn hình hiện toast.
 *
 * Token được nạp vào biến bộ nhớ (memoryToken) để không phải đọc AsyncStorage
 * mỗi lần gọi; AuthContext chịu trách nhiệm set/clear khi đăng nhập/đăng xuất.
 */
let memoryToken = null;
let unauthorizedHandler = null;

export const tokenStore = {
  set(value) {
    memoryToken = value || null;
    if (value) AsyncStorage.setItem(STORAGE_KEYS.token, value);
    else AsyncStorage.removeItem(STORAGE_KEYS.token);
  },
  get() {
    return memoryToken;
  },
  async load() {
    memoryToken = await AsyncStorage.getItem(STORAGE_KEYS.token);
    return memoryToken;
  },
};

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.messageCode;
    this.detail = body?.detail;
  }

  get isConflict() {
    return this.status === 409;
  }
}

export function isConflict(error) {
  return error instanceof ApiError && error.status === 409;
}

async function parseError(res) {
  let body;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  return new ApiError(res.status, body?.message || `Yêu cầu thất bại (${res.status})`, body);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let res;
  try {
    res = await fetch(API_BASE + path, { ...options, headers });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ API (" + API_BASE + ").");
  }

  if (res.status === 401) {
    if (unauthorizedHandler) unauthorizedHandler();
    throw await parseError(res);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined;

  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return await res.json();
  return await res.text();
}

// Ghép query string, bỏ qua giá trị rỗng/null.
export function query(params) {
  if (!params) return "";
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? "?" + parts.join("&") : "";
}

export const http = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: (p, body) => request(p, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: (p, body) => request(p, { method: "DELETE", body: body === undefined ? undefined : JSON.stringify(body) }),
};
