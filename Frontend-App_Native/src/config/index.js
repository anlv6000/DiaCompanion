import Constants from "expo-constants";

const fromConfig = Constants.expoConfig?.extra?.apiBase;

const DEFAULT_API = "https://diacompanion.io.vn";

export const API_BASE = (fromConfig || DEFAULT_API).replace(/\/$/, "");

// Khoá lưu phiên trong AsyncStorage.
export const STORAGE_KEYS = {
  token: "diacompanion.token",
  user: "diacompanion.user",
};