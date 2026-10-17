import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  cacheDir: fileURLToPath(new URL(".vite", import.meta.url)),
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4183, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
