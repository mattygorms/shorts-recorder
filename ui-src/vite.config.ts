import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { viteSingleFile } from "vite-plugin-singlefile"
// Builds ONE self-contained file: ../app/index.html (no CDN, no extra assets)
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "../app", emptyOutDir: false, assetsInlineLimit: 100000000 },
})
