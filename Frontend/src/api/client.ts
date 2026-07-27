import { API_BASE, STORAGE_KEYS } from "@/config";
import type { ApiMessage } from "@/types/api";

/* Lớp HTTP mỏng. Token giữ trong sessionStorage; mọi request tự đính Bearer.
   API_BASE lấy từ config (không đọc window trực tiếp ở đây). */

const TOKEN_KEY = STORAGE_KEYS.token;

export { API_BASE };

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (v: string | null) =>
    v
      ? sessionStorage.setItem(TOKEN_KEY, v)
      : sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: string;
  traceId?: string;
  constructor(status: number, message: string, body?: ApiMessage) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.messageCode;
    this.detail = body?.detail;
    this.traceId = body?.traceId;
  }
}

async function parseError(res: Response): Promise<never> {
  let body: ApiMessage | undefined;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  throw new ApiError(
    res.status,
    body?.message || `Yêu cầu thất bại (${res.status})`,
    body,
  );
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + path, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      "Không kết nối được backend. Kiểm tra API đang chạy tại " + API_BASE,
    );
  }

  // Token hết hạn / không hợp lệ → phát sự kiện để AuthContext đẩy về login.
  if (res.status === 401)
    window.dispatchEvent(new CustomEvent("dc:unauthorized"));
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;

  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

export const http = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, b?: unknown) =>
    request<T>(p, {
      method: "POST",
      body: b === undefined ? undefined : JSON.stringify(b),
    }),
  put: <T>(p: string, b?: unknown) =>
    request<T>(p, {
      method: "PUT",
      body: b === undefined ? undefined : JSON.stringify(b),
    }),
  delete: <T>(p: string) => request<T>(p, { method: "DELETE" }),
  upload: <T>(p: string, f: FormData) =>
    request<T>(p, { method: "POST", body: f }),
  blob: async (p: string): Promise<Blob> => {
    const headers = new Headers();
    const token = tokenStore.get();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(API_BASE + p, { headers });
    if (!res.ok) await parseError(res);
    return await res.blob();
  },
};
