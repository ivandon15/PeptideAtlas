import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base:
    mode === "public"
      ? process.env.ATLAS_PUBLIC_BASE || "/peptide-atlas/"
      : "/",
  publicDir: "data/public",
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:" + (process.env.ATLAS_API_PORT || "8766"),
    },
  },
  build: { outDir: mode === "public" ? "dist-public" : "dist" },
}));
