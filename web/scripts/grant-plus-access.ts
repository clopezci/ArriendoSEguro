import { getAdminAuth, getAdminFirestore } from "../src/lib/firebase/admin";
import { grantManualPlusEntitlement } from "../src/domain/platform-payments/manual-grant";

function parseArgs() {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [k, ...rest] = arg.slice(2).split("=");
    map.set(k, rest.join("="));
  }
  const email = (map.get("email") ?? "").trim();
  const validDaysRaw = map.get("validDays");
  const validDays = validDaysRaw ? Number.parseInt(validDaysRaw, 10) : 30;
  return { email, validDays };
}

async function main() {
  if (!(process.env.NODE_ENV === "development" || process.env.ADMIN_INTERNAL_ENABLED === "true")) {
    throw new Error("Operación bloqueada. Usa development o ADMIN_INTERNAL_ENABLED=true.");
  }

  const { email, validDays } = parseArgs();
  if (!email) {
    throw new Error("Falta --email. Ejemplo: npm run grant:plus -- --email=clopezci@hotmail.com");
  }

  const auth = getAdminAuth();
  const firestore = getAdminFirestore();
  if (!auth || !firestore) {
    throw new Error("Firebase Admin no configurado.");
  }

  const result = await grantManualPlusEntitlement(
    { auth, firestore, requestedBy: "internal_script" },
    { email, validDays },
  );

  if (!result.ok) {
    if (result.reason === "user_not_found") {
      throw new Error(`El usuario ${result.email} no existe en Auth. Regístralo primero.`);
    }
    throw new Error("No se pudo crear entitlement manual.");
  }

  if (result.status === "already_exists") {
    console.log(
      JSON.stringify(
        {
          success: true,
          status: "already_exists",
          message: "Ya existe entitlement Plus activo disponible para este usuario.",
          entitlementId: result.entitlementId,
          userId: result.userId,
          userEmail: result.userEmail,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        status: "created",
        message: "Entitlement Plus creado manualmente para pruebas.",
        entitlementId: result.entitlementId,
        userId: result.userId,
        userEmail: result.userEmail,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[grant-plus-access]", error instanceof Error ? error.message : "Error desconocido.");
  process.exit(1);
});

