/**
 * RESET DE BASE DE DATOS DE PRUEBA (Firebase Auth + Firestore + Storage).
 *
 * ⚠️ DESTRUCTIVO. Borra:
 *   - Todos los usuarios de Authentication EXCEPTO los correos en KEEP_EMAILS.
 *   - Todos los documentos de las colecciones de datos de prueba (TEST_COLLECTIONS).
 *   - Los archivos de Storage bajo el prefijo "contracts/".
 * NO toca la configuración (app_settings, partners) ni los logs.
 *
 * CÓMO CORRERLO (desde la carpeta `web`):
 *   1) Ten a mano tu clave de cuenta de servicio (el JSON de Firebase).
 *      - Si ya tienes un archivo .json local, usa FIREBASE_SERVICE_ACCOUNT_FILE.
 *      - O pega el JSON completo en FIREBASE_SERVICE_ACCOUNT_KEY.
 *   2) Define también el bucket de Storage (FIREBASE_STORAGE_BUCKET).
 *   3) Ejecuta con el flag --yes (sin él, solo muestra un resumen y NO borra):
 *
 *   PowerShell (Windows):
 *     $env:FIREBASE_SERVICE_ACCOUNT_FILE="C:\ruta\a\serviceAccount.json"
 *     $env:FIREBASE_STORAGE_BUCKET="tu-bucket.appspot.com"
 *     node scripts/reset-test-db.mjs            # simulacro (no borra)
 *     node scripts/reset-test-db.mjs --yes      # borra de verdad
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ VERIFICA ESTOS CORREOS ANTES DE CORRER. Cualquier usuario que NO esté aquí
// será ELIMINADO de Authentication. (Ojo: "hotamail" parece un typo de "hotmail";
// corrígelo si aplica, o el admin real no quedará protegido.)
const KEEP_EMAILS = ["clopezci@hotamail.com", "clpezci@gmail.com"].map((e) => e.toLowerCase());

// Colecciones de DATOS DE PRUEBA que se vacían. (La config —app_settings, partners—
// y los logs NO están aquí a propósito.)
const TEST_COLLECTIONS = [
  "contracts", "contract_versions", "contract_annexes", "contract_drafts",
  "signatures", "party_invites", "party_invite_supports", "saved_party_profiles",
  "draft_property_docs", "property_documents",
  "contract_payment_settings", "payments_log", "payment_support_files",
  "payment_upload_tokens", "scheduled_payments",
  "inventories", "inventory_items", "inventory_meter_readings", "inventory_keys",
  "inventory_selected_zones", "inventory_zone_details", "inventory_zone_items",
  "utility_guarantee_acceptances", "oath_evidence",
  "access_entitlements", "platform_orders", "platform_payments",
  "reputation_reviews", "reputation_aggregates", "reputation_flags", "reputation_lookup_consents",
  "referrals", "referral_codes",
  "user_consents", "user_landlord_profiles", "user_properties",
  "lead_forms", "contact_messages", "hub_orders", "hub_payments",
];
// ─────────────────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes("--yes");

function loadServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (fromEnv) return JSON.parse(fromEnv);
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_KEY o FIREBASE_SERVICE_ACCOUNT_FILE.");
}

initializeApp({ credential: cert(loadServiceAccount()) });
const auth = getAuth();
const db = getFirestore();
const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();

async function deleteNonAdminUsers() {
  let deleted = 0, kept = 0, nextPageToken;
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    const toDelete = res.users.filter((u) => !KEEP_EMAILS.includes((u.email ?? "").toLowerCase()));
    kept += res.users.length - toDelete.length;
    if (APPLY && toDelete.length) {
      // deleteUsers acepta hasta 1000 uids por llamada.
      const r = await auth.deleteUsers(toDelete.map((u) => u.uid));
      deleted += r.successCount;
    } else {
      deleted += toDelete.length;
    }
    nextPageToken = res.pageToken;
  } while (nextPageToken);
  console.log(`  Auth: ${APPLY ? "borrados" : "se borrarían"} ${deleted} usuarios; conservados ${kept}.`);
}

async function wipeCollection(name) {
  const col = db.collection(name);
  let total = 0;
  while (true) {
    const snap = await col.limit(300).get();
    if (snap.empty) break;
    total += snap.size;
    if (!APPLY) break; // en simulacro solo contamos el primer lote (aprox.)
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`  ${name}: ${APPLY ? "borrados" : "≥"} ${total} docs.`);
}

async function wipeStorage() {
  if (!bucketName) { console.log("  Storage: (sin FIREBASE_STORAGE_BUCKET, se omite)"); return; }
  const bucket = getStorage().bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: "contracts/" });
  if (APPLY) await Promise.all(files.map((f) => f.delete().catch(() => {})));
  console.log(`  Storage contracts/: ${APPLY ? "borrados" : "se borrarían"} ${files.length} archivos.`);
}

(async () => {
  console.log(APPLY ? "\n=== BORRANDO (modo real) ===" : "\n=== SIMULACRO (usa --yes para borrar) ===");
  console.log("Conservando admins:", KEEP_EMAILS.join(", "), "\n");
  await deleteNonAdminUsers();
  for (const c of TEST_COLLECTIONS) await wipeCollection(c);
  await wipeStorage();
  console.log(APPLY ? "\n✅ Reset completo.\n" : "\nℹ️ Simulacro. Revisa la lista y corre con --yes para aplicar.\n");
  process.exit(0);
})().catch((e) => { console.error("Error:", e); process.exit(1); });
