import { vitePlugin as remix } from "@remix-run/dev";
import { flatRoutes } from "remix-flat-routes";
import { remixRoutes } from "remix-routes/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  build: {
    cssMinify: process.env.NODE_ENV === "production",
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/*"],
      serverModuleFormat: "esm",
      routes: (defineRoutes) => {
        return flatRoutes("routes", defineRoutes);
      },
    }),
    remixRoutes({
      outDir: ".",
    }),
    tsconfigPaths(),
  ],
});
