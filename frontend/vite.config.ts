import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Loads VITE_* variables from the repo-root .env, one level above frontend/.
  envDir: "..",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
