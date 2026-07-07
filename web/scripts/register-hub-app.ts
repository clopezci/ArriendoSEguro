import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../src/lib/firebase/admin";
import {
  HUB_APPS_COLLECTION,
  generateHubCredentials,
  type HubApp,
} from "../src/domain/hub/hub-apps";

function parseArgs() {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [k, ...rest] = arg.slice(2).split("=");
    map.set(k, rest.join("="));
  }
  return { name: (map.get("name") ?? "").trim(), webhook: (map.get("webhook") ?? "").trim() };
}

async function main() {
  if (!(process.env.NODE_ENV === "development" || process.env.ADMIN_INTERNAL_ENABLED === "true")) {
    throw new Error("Operación bloqueada. Usa development o ADMIN_INTERNAL_ENABLED=true.");
  }
  const { name, webhook } = parseArgs();
  if (name.length < 2 || !webhook) {
    throw new Error('Uso: npm run hub:register -- --name="MiApp" --webhook="https://miapp.com/api/hub/webhook"');
  }
  try {
    new URL(webhook);
  } catch {
    throw new Error("La URL de webhook no es válida.");
  }

  const firestore = getAdminFirestore();
  if (!firestore) throw new Error("Firebase Admin no configurado.");

  const creds = generateHubCredentials();
  const ref = firestore.collection(HUB_APPS_COLLECTION).doc();
  const app: HubApp = {
    id: ref.id,
    name,
    apiKeyPrefix: creds.apiKeyPrefix,
    apiKeyHash: creds.apiKeyHash,
    hmacSecret: creds.hmacSecret,
    webhookUrl: webhook,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await ref.set({ ...app, createdAtServer: FieldValue.serverTimestamp() });

  console.log(
    JSON.stringify(
      {
        success: true,
        message: "App registrada. Copia estas credenciales, no se vuelven a mostrar.",
        appId: ref.id,
        name,
        webhookUrl: webhook,
        apiKey: creds.apiKey,
        hmacSecret: creds.hmacSecret,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[register-hub-app]", error instanceof Error ? error.message : "Error desconocido.");
  process.exit(1);
});
