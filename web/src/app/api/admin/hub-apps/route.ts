import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  HUB_APPS_COLLECTION,
  generateHubCredentials,
  toPublicHubApp,
  type HubApp,
} from "@/domain/hub/hub-apps";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const snap = await firestore.collection(HUB_APPS_COLLECTION).limit(100).get();
  const apps = snap.docs.map((d) => toPublicHubApp(d.data() as HubApp));
  return NextResponse.json({ success: true, apps });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  webhookUrl: z.string().url().max(500),
});

export async function POST(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const creds = generateHubCredentials();
  const ref = firestore.collection(HUB_APPS_COLLECTION).doc();
  const now = new Date().toISOString();
  const app: HubApp = {
    id: ref.id,
    name: parsed.data.name.trim(),
    apiKeyPrefix: creds.apiKeyPrefix,
    apiKeyHash: creds.apiKeyHash,
    hmacSecret: creds.hmacSecret,
    webhookUrl: parsed.data.webhookUrl,
    active: true,
    createdAt: now,
  };
  await ref.set({ ...app, createdAtServer: FieldValue.serverTimestamp() });
  await auditPlatformPaymentEvent(firestore, "admin_hub_app_created", { appId: ref.id, name: app.name });

  // Los secretos se devuelven UNA sola vez (no se pueden volver a consultar).
  return NextResponse.json({
    success: true,
    app: toPublicHubApp(app),
    apiKey: creds.apiKey,
    hmacSecret: creds.hmacSecret,
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  webhookUrl: z.string().url().max(500).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  const ref = firestore.collection(HUB_APPS_COLLECTION).doc(parsed.data.id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, errors: [{ field: "id", message: "App no encontrada." }] }, { status: 404 });
  }
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof parsed.data.active === "boolean") patch.active = parsed.data.active;
  if (parsed.data.webhookUrl) patch.webhookUrl = parsed.data.webhookUrl;
  await ref.set(patch, { merge: true });
  await auditPlatformPaymentEvent(firestore, "admin_hub_app_updated", { appId: parsed.data.id });

  const updated = (await ref.get()).data() as HubApp;
  return NextResponse.json({ success: true, app: toPublicHubApp(updated) });
}
