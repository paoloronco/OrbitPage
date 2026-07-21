import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

export default defineConfig({
  base: "/orbitpage-hosted/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    "import.meta.env.VITE_ORBITPAGE_HOSTED_MODE": JSON.stringify("true"),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-hosted",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/hosted-entry.tsx"),
      name: "OrbitPageHostedAdminBundle",
      formats: ["es"],
      fileName: () => "orbitpage-hosted.js",
    },
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith(".css")
          ? "orbitpage-hosted.css"
          : "assets/[name]-[hash][extname]",
      },
    },
  },
});
