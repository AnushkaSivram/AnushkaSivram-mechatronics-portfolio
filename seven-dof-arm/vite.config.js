import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative assets allow the same build to work on Netlify and in the
  // /seven-dof-arm/ subdirectory of this repository's GitHub Pages site.
  base: "./",
  plugins: [react()],
});
