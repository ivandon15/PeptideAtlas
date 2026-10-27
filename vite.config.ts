import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:" + (process.env.ATLAS_API_PORT || "8766"),
    },
  },
  build: { outDir: "dist" },
});
