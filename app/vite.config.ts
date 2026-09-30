import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

export function vendorChunk(id: string) {
  if (!id.includes("node_modules/")) return;
  if (/node_modules\/(?:react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "react-vendor";
  if (/node_modules\/(?:@mui|@emotion)\//.test(id)) return "material-ui";
  if (id.includes("node_modules/@radix-ui/")) return "radix-ui";
  if (/node_modules\/(?:recharts|d3-[^/]+)\//.test(id)) return "charts";
}

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
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
        entryFileNames: "assets/orbitpage.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css")
            ? "assets/orbitpage.css"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
}));
