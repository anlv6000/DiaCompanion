import Constants from "expo-constants";

const fromConfig =
  Constants.expoConfig?.extra?.apiBase;

const DEFAULT_API =
  "http://192.168.1.2:8081";

export const API_BASE = ("https://localhost:55403").replace(/\/$/, "");

// Khoá lưu phiên trong AsyncStorage.
export const STORAGE_KEYS = {
  token: "diacompanion.token",
  user: "diacompanion.user",
};
