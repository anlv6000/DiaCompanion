import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    // Proxy để gọi backend cùng origin khi dev (tránh CORS).
    proxy: { "/api": { target: "https://diacompanion.io.vn", changeOrigin: true } },
  },
});
