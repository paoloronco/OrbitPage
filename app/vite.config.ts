import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Build assets as relocatable URLs. The Express server rewrites the entry
  // HTML tags to the active mount path (`/` or `BASE_PATH`) at request time.
  base: "./",
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Injected at build time — access via __APP_VERSION__ in source code
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
}));
