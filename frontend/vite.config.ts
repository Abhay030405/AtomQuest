import path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function devRouteLogger(): Plugin {
  return {
    name: "dev-route-logger",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/route-log", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1_000_000) {
            res.statusCode = 413;
            res.end();
            req.destroy();
          }
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body || "{}");
            const pathName = typeof payload.path === "string" ? payload.path : "(unknown)";
            const status = typeof payload.status === "number" ? payload.status : "-";
            console.log(`[route] ${status} ${pathName}`);
          } catch {
            console.log("[route] (invalid payload)");
          }

          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devRouteLogger()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
