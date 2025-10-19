import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'localhost',  // Default
      'https://1141c25fab8e.ngrok-free.app'  // Your ngrok host
    ]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
