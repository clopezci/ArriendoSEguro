import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz de la app Next (carpeta `web`); fija el tracing cuando hay varios `package-lock` en el PC o monorepos. */
const appDir = path.dirname(fileURLToPath(import.meta.url));

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  outputFileTracingRoot: appDir,
  /**
   * `resend` (v6) hace `import("@react-email/render")` de forma diferida para
   * soportar plantillas en React. Nosotros enviamos HTML plano, así que ese
   * módulo opcional no está instalado y Turbopack falla al bundlearlo.
   * Marcando `resend` como external del servidor, Next no lo bundlea y Node
   * lo carga en runtime, donde la importación dinámica nunca se ejecuta.
   */
  serverExternalPackages: ["resend"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? ([{ key: "Content-Security-Policy", value: csp }] as const)
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
