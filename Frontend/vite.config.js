import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },
    server: { port: 5173 },
    // base "./" so the built bundle also works when loaded from file:// inside Electron
    base: "./",
});
