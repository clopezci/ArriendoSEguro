import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;

/**
 * Carga la cuenta de servicio desde FIREBASE_SERVICE_ACCOUNT_KEY (JSON en una sola línea
 * o variable de entorno en Vercel). Sin esto, resolveFirebaseAdmin() devuelve null.
 */
function initAdmin(): App | null {
  if (getApps().length > 0) {
    return getApps()[0] ?? null;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const cred = cert(JSON.parse(raw) as Record<string, unknown>);
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
