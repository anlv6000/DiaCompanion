import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/contexts/AuthContext";
import { DataProvider } from "./src/contexts/DataContext";
import { ToastProvider } from "./src/contexts/ToastContext";
import RootNavigation from "./src/navigation";

/**
 * Gốc ứng dụng. Thứ tự provider:
 *  AuthProvider  — phiên đăng nhập (quyết định hiện màn login hay app chính).
 *  DataProvider  — cửa duy nhất tới backend (mọi màn lấy dữ liệu ở đây).
 *  ToastProvider — thông báo nhanh.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <RootNavigation />
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
