import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'localhost',  // Default
      'cb9be27c.ngrok-free.app'  // Your ngrok host
    ]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
