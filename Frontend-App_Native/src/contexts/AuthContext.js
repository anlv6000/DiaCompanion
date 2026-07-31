import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "../api/services";
import { tokenStore, setUnauthorizedHandler } from "../api/client";
import { STORAGE_KEYS } from "../config";

/**
 * Phiên đăng nhập của BỆNH NHÂN.
 *
 * Bệnh nhân đăng nhập bằng số điện thoại — hoặc mật khẩu, hoặc mã OTP.
 * Token + thông tin user lưu trong AsyncStorage để mở lại app không phải
 * đăng nhập lại. Nếu token hết hạn giữa chừng, client bắn tín hiệu và ta
 * xoá phiên để điều hướng quay về màn đăng nhập.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true); // đang khôi phục phiên lúc mở app

  const persist = useCallback(async (u) => {
    setUser(u);
    if (u) await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEYS.user);
  }, []);

  const clearSession = useCallback(async () => {
    tokenStore.set(null);
    await persist(null);
  }, [persist]);

  // Khôi phục phiên khi mở app.
  useEffect(() => {
    (async () => {
      try {
        await tokenStore.load();
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.user);
        if (tokenStore.get() && raw) {
          setUser(JSON.parse(raw));
          // Xác minh token còn hạn; nếu hỏng, me() sẽ ném 401 -> clear.
          try {
            const fresh = await authApi.me();
            await persist({ ...JSON.parse(raw), ...fresh });
          } catch {
            await clearSession();
          }
        }
      } finally {
        setBooting(false);
      }
    })();
  }, [persist, clearSession]);

  // Token hết hạn giữa chừng -> xoá phiên.
  useEffect(() => {
    setUnauthorizedHandler(() => { clearSession(); });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const afterLogin = useCallback(async (res) => {
    tokenStore.set(res.token || null);
    await persist(res);
    return res;
  }, [persist]);

  const loginPassword = useCallback(async (phone, password) => {
    return afterLogin(await authApi.loginPassword(phone.trim(), password));
  }, [afterLogin]);

  const loginOtp = useCallback(async (phone, code) => {
    return afterLogin(await authApi.loginOtp(phone.trim(), code.trim()));
  }, [afterLogin]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* vẫn xoá phiên cục bộ */ }
    await clearSession();
  }, [clearSession]);

  const changePassword = useCallback(async (current, next) => {
    await authApi.changePassword(current, next);
    if (user) await persist({ ...user, mustChangePassword: false });
  }, [persist, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        booting,
        isAuthenticated: !!user,
        mustChangePassword: !!user?.mustChangePassword,
        patientId: user?.patientId ?? null,
        loginPassword,
        loginOtp,
        logout,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong AuthProvider");
  return ctx;
}
