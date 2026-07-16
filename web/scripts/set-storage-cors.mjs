/**
 * CONFIGURA EL CORS DEL BUCKET DE STORAGE (arreglo global de subidas).
 *
 * Varios formularios suben archivos directo del navegador a Storage con una URL
 * firmada (PUT). Si el bucket NO tiene CORS que permita el origen de la app, el
 * navegador bloquea la subida y sale "error de red". Este script habilita el
 * origen de tu app para GET/PUT/POST/HEAD y así TODAS las subidas funcionan.
 *
 * CÓMO CORRERLO (desde la carpeta `web`), igual que reset-test-db:
 *   1) Ten a mano tu clave de cuenta de servicio (el JSON de Firebase):
 *      $env:FIREBASE_SERVICE_ACCOUNT_FILE="C:\ruta\a\serviceAccount.json"
 *      $env:FIREBASE_STORAGE_BUCKET="tu-bucket.appspot.com"
 *   2) (Opcional) agrega tu dominio si no es arriendoseguro.app:
 *      $env:APP_ORIGINS="https://arriendoseguro.app,https://www.arriendoseguro.app"
 *   3) node scripts/set-storage-cors.mjs
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

function loadServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (fromEnv) return JSON.parse(fromEnv);
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_KEY o FIREBASE_SERVICE_ACCOUNT_FILE.");
}

const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
if (!bucketName) throw new Error("Falta FIREBASE_STORAGE_BUCKET.");

const origins = (process.env.APP_ORIGINS?.trim() ||
  "https://arriendoseguro.app,https://www.arriendoseguro.app,http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

initializeApp({ credential: cert(loadServiceAccount()) });

const cors = [
  {
    origin: origins,
    method: ["GET", "PUT", "POST", "HEAD"],
    responseHeader: ["Content-Type", "x-goog-resumable"],
    maxAgeSeconds: 3600,
  },
];

(async () => {
  const bucket = getStorage().bucket(bucketName);
  await bucket.setCorsConfiguration(cors);
  console.log(`\n✅ CORS aplicado al bucket ${bucketName} para:`, origins.join(", "), "\n");
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
