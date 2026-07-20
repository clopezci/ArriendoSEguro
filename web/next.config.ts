import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz de la app Next (carpeta `web`); fija el tracing cuando hay varios `package-lock` en el PC o monorepos. */
const appDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Content Security Policy de producción.
 *
 * El SDK de Firebase Auth y, eventualmente, de Firestore en cliente llaman a
 * `*.googleapis.com` (identitytoolkit, securetoken, firestore). Si `connect-src`
 * queda en `'self'`, el navegador bloquea esas requests y el SDK devuelve
 * `auth/network-request-failed`, que nuestro mapeo traduce a "No hay conexión
 * con los servidores de Firebase". Aquí dejamos solo los orígenes que
 * realmente necesitamos.
 *
 * Cloudflare Turnstile (cuando esté habilitado) carga su script y un iframe
 * desde `https://challenges.cloudflare.com`.
 *
 * Si en el futuro se usa Google Fonts servido desde CDN o Google reCAPTCHA en
 * Auth, ampliar `style-src`, `font-src` y `script-src` con sus dominios.
 */
const csp = [
  "default-src 'self'",
  // apis.google.com: el SDK de Firebase Auth carga el cliente de Google (gapi)
  // para el acceso con Google por POPUP (escritorio). Sin él, el popup falla con
  // `auth/internal-error` ("Google no está disponible aquí").
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.gstatic.com https://www.googletagmanager.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://www.google-analytics.com https://www.googletagmanager.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.googleapis.com https://apis.google.com https://accounts.google.com https://*.firebaseapp.com https://www.gstatic.com https://challenges.cloudflare.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://*.ingest.us.sentry.io https://*.ingest.sentry.io",
  // frame-src: el acceso con Google usa un iframe oculto al authDomain de Firebase
  // (`*.firebaseapp.com`) y a Google (apis/accounts). Sin estos, el popup de Google
  // se bloquea. (El redirect de móvil no usa iframe, por eso sí funcionaba.)
  "frame-src 'self' https://challenges.cloudflare.com https://apis.google.com https://accounts.google.com https://*.firebaseapp.com",
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
  serverExternalPackages: ["resend", "firebase-admin"],
  /**
   * Autenticación desde el PROPIO dominio (anti-bloqueadores). Firebase Auth
   * normalmente sirve su "handler" de OAuth desde `<proyecto>.firebaseapp.com`,
   * que las extensiones de rastreo/seguridad suelen bloquear. Si en Vercel se
   * fija `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=arriendoseguro.app`, el SDK pedirá
   * `/__/auth/...` en NUESTRO dominio y aquí lo redirigimos (proxy) al handler
   * real de Firebase. Así la auth es de primera parte y no la bloquean.
   *
   * Requiere además (config del usuario): agregar
   * `https://arriendoseguro.app/__/auth/handler` a las "Authorized redirect URIs"
   * del cliente OAuth en Google Cloud. Si no se fija el env, estas reglas quedan
   * inertes (nadie pide /__/auth en este dominio).
   */
  async rewrites() {
    const firebaseAuthHost = "https://arriendoseguro-c5602.firebaseapp.com";
    return [
      { source: "/__/auth/:path*", destination: `${firebaseAuthHost}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `${firebaseAuthHost}/__/firebase/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // Excluimos `/__/` (el handler de Firebase proxeado): no debe llevar
        // nuestra CSP restrictiva ni X-Frame-Options, o rompería el login.
        source: "/((?!__/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // microphone=(self): habilita el dictado por voz en el propio sitio
          // (antes estaba en () = deshabilitado para todos, y el navegador nunca
          // pedía permiso ni aparecía "Micrófono" en los ajustes del sitio).
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? ([{ key: "Content-Security-Policy", value: csp }] as const)
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
