import { createRequire } from "node:module";
import path from "node:path";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);

// Destino interno de la API. En Docker se fija en build (ver web.Dockerfile).
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Docker publica la web en 127.0.0.1. Sin esto, la recarga en caliente se bloquea y el navegador entra en bucle.
  allowedDevOrigins: ["127.0.0.1", "web"],
  output: "standalone",
  // En un monorepo, Next debe rastrear dependencias desde la raíz del repo
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: [require.resolve("@tailwindcss/turbopack")],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
      { source: "/media/:path*", destination: `${API_INTERNAL_URL}/media/:path*` },
    ];
  },
};

export default nextConfig;
