import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";

let adminApp: App | null = null;

/**
 * Carga la cuenta de servicio:
 * - Vercel / producción: `FIREBASE_SERVICE_ACCOUNT_KEY` = JSON (una línea o pegado en el panel).
 * - Desarrollo local: `FIREBASE_SERVICE_ACCOUNT_FILE` = ruta a un .json (sin subir a internet).
 */
function loadServiceAccountObject(): Record<string, unknown> | null {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
  if (file) {
    try {
      const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      const resolved = path.resolve(abs);
      const cwd = path.resolve(process.cwd());
      const rel = path.relative(cwd, resolved);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return null;
      }
      const text = readFileSync(resolved, "utf8");
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function initAdmin(): App | null {
  if (getApps().length > 0) {
    return getApps()[0] ?? null;
  }
  const credJson = loadServiceAccountObject();
  if (!credJson) return null;
  try {
    const cred = cert(credJson);
    adminApp = initializeApp({ credential: cred });
    return adminApp;
  } catch {
    return null;
  }
}

export function getAdminFirestore(): Firestore | null {
  const app = initAdmin();
  if (!app) return null;
  return getFirestore(app);
}
