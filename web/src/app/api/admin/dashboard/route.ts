import { NextResponse } from "next/server";
import type { UserRecord } from "firebase-admin/auth";
import { Timestamp, type QuerySnapshot } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { buildAdminSurveyRow } from "@/lib/validations/lead-form-export-labels";

export const runtime = "nodejs";

function iso(v: unknown): string | null {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return null;
}

function summarizeMeta(m: unknown): string {
  if (m == null) return "";
  try {
    const s = JSON.stringify(m);
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  } catch {
    return "";
  }
}

async function countSafe(
  fn: () => Promise<{ data: () => { count: number } }>,
): Promise<number | null> {
  try {
    return (await fn()).data().count;
  } catch {
    return null;
  }
}

async function listAllAuthUsers(auth: NonNullable<ReturnType<typeof getAdminAuth>>): Promise<UserRecord[]> {
  const out: UserRecord[] = [];
  let token: string | undefined;
  for (let page = 0; page < 50; page++) {
    const res = await auth.listUsers(1000, token);
    out.push(...res.users);
    token = res.pageToken;
    if (!token) break;
  }
  return out;
}

async function safeQueryDocs(
  label: string,
  fn: () => Promise<QuerySnapshot>,
): Promise<QuerySnapshot | null> {
  try {
    return await fn();
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn(`[admin] query ${label}`, e);
    return null;
  }
}

export async function GET(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  const auth = getAdminAuth();
  if (!firestore || !auth) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  try {
    const authUsers = await listAllAuthUsers(auth);
    const usersRegistered = authUsers.length;

    const [
      surveysCount,
      demoActive,
      plusActive,
      contractsCount,
      versionsCount,
      paymentsApproved,
      contractsSigned,
    ] = await Promise.all([
      countSafe(() => firestore.collection("lead_forms").count().get()),
      countSafe(() =>
        firestore
          .collection("access_entitlements")
          .where("status", "==", "active")
          .where("accessType", "==", "demo")
          .count()
          .get(),
      ),
      countSafe(() =>
        firestore
          .collection("access_entitlements")
          .where("status", "==", "active")
          .where("accessType", "==", "plus_paid")
          .count()
          .get(),
      ),
      countSafe(() => firestore.collection("contracts").count().get()),
      countSafe(() => firestore.collection("contract_versions").count().get()),
      countSafe(() =>
        // platform_payments guarda el estado del PSP en MAYÚSCULAS ("APPROVED").
        firestore.collection("platform_payments").where("status", "==", "APPROVED").count().get(),
      ),
      countSafe(() => firestore.collection("contracts").where("status", "==", "signed").count().get()),
    ]);

    // Embudo de conversión (KPIs). La visita a la landing proviene de GA4
    // (no de Firestore); aquí medimos de encuesta en adelante.
    const pct = (num: number | null, den: number | null): number | null =>
      num != null && den != null && den > 0 ? Math.round((num / den) * 1000) / 10 : null;
    const funnel = {
      surveys: surveysCount,
      registered: usersRegistered,
      contractsCreated: contractsCount,
      contractsSigned,
      surveyToRegistered: pct(usersRegistered, surveysCount),
      registeredToContract: pct(contractsCount, usersRegistered),
      contractToSigned: pct(contractsSigned, contractsCount),
    };

    const [leadsSnap, auditSnap, entitlementsSnap, ordersSnap, paymentsSnap, contractsSnap] =
      await Promise.all([
        safeQueryDocs("lead_forms", () =>
          firestore.collection("lead_forms").orderBy("createdAt", "desc").limit(150).get(),
        ),
        safeQueryDocs("audit_logs", () =>
          firestore.collection("audit_logs").orderBy("createdAtServer", "desc").limit(100).get(),
        ),
        safeQueryDocs("access_entitlements", () => firestore.collection("access_entitlements").limit(200).get()),
        safeQueryDocs("platform_orders", () => firestore.collection("platform_orders").limit(120).get()),
        safeQueryDocs("platform_payments", () => firestore.collection("platform_payments").limit(120).get()),
        safeQueryDocs("contracts", () => firestore.collection("contracts").limit(80).get()),
      ]);

    const surveys =
      leadsSnap?.docs.map((d) => buildAdminSurveyRow(d.id, d.data() as Record<string, unknown>)) ?? [];

    const auditRows =
      auditSnap?.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          eventName: String(x.event ?? "unknown"),
          userId: String(x.userId ?? ""),
          entityId: String(x.orderId ?? x.contractId ?? x.paymentId ?? x.entitlementId ?? ""),
          createdAt: iso(x.createdAtServer) ?? String(x.at ?? ""),
          metadataSummary: summarizeMeta(
            Object.fromEntries(
              Object.entries(x).filter(([k]) => !["event", "at", "createdAtServer"].includes(k)),
            ),
          ),
        };
      }) ?? [];

    const errorish = auditRows.filter((r) =>
      /fail|error|reject|denied|invalid/i.test(`${r.eventName} ${r.metadataSummary}`),
    );

    const accesses =
      entitlementsSnap?.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userEmail: String(x.userEmail ?? ""),
          userId: String(x.userId ?? ""),
          planCode: String(x.planCode ?? ""),
          accessType: String(x.accessType ?? ""),
          status: String(x.status ?? ""),
          contractsUsed: Number(x.contractsUsed ?? 0),
          maxContractsAllowed: Number(x.maxContractsAllowed ?? 0),
          validUntil: x.validUntil != null ? String(x.validUntil) : "",
          leaseProcessId: x.leaseProcessId != null ? String(x.leaseProcessId) : "",
          updatedAt: iso(x.updatedAtServer) ?? String(x.updatedAt ?? ""),
        };
      }) ?? [];

    const entitlementByLease = new Map<string, { userEmail: string; userId: string }>();
    accesses.forEach((e) => {
      if (e.leaseProcessId && e.userEmail) {
        entitlementByLease.set(e.leaseProcessId, { userEmail: e.userEmail, userId: e.userId });
      }
    });

    const platformPayments = paymentsSnap?.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        orderId: String(x.orderId ?? ""),
        userEmail: String(x.userEmail ?? ""),
        plan: "plus",
        amount: Number(x.amount ?? 0),
        status: String(x.status ?? ""),
        provider: String(x.provider ?? ""),
        createdAt: iso(x.createdAtServer) ?? String(x.createdAt ?? ""),
        approvedAt: x.approvedAt != null ? String(x.approvedAt) : "",
      };
    }) ?? [];

    const platformOrders =
      ordersSnap?.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userEmail: String(x.userEmail ?? ""),
          plan: String(x.planCode ?? ""),
          amount: Number(x.amount ?? 0),
          status: String(x.status ?? ""),
          provider: String(x.paymentProvider ?? ""),
          createdAt: iso(x.createdAtServer) ?? String(x.createdAt ?? ""),
        };
      }) ?? [];

    const inventorySnap = await safeQueryDocs("inventories", () => firestore.collection("inventories").limit(400).get());
    const invByLease = new Set<string>();
    inventorySnap?.docs.forEach((d) => {
      const lp = (d.data() as { leaseProcessId?: string }).leaseProcessId;
      if (lp) invByLease.add(lp);
    });

    const schedSnap = await safeQueryDocs("scheduled_payments", () =>
      firestore.collection("scheduled_payments").limit(500).get(),
    );
    const schedByContract = new Set<string>();
    schedSnap?.docs.forEach((d) => {
      const cid = (d.data() as { contractId?: string }).contractId;
      if (cid) schedByContract.add(cid);
    });

    const expedientes =
      contractsSnap?.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        const id = d.id;
        const draftId = String(x.draftId ?? id);
        const ent = entitlementByLease.get(id) ?? entitlementByLease.get(draftId);
        const status = String(x.status ?? "draft");
        const hasVersion = Boolean(x.currentVersionId);
        const signed = status === "signed";
        return {
          leaseProcessId: id,
          userEmail: ent?.userEmail ?? "—",
          estado: status,
          contratoGenerado: hasVersion,
          firmado: signed,
          inventario: invByLease.has(id) || invByLease.has(draftId),
          pagosProgramados: schedByContract.has(id),
          updatedAt: iso(x.updatedAt) ?? "",
        };
      }) ?? [];

    const usersWithAccess = authUsers.map((u) => {
      const ents = accesses.filter((e) => e.userId === u.uid);
      const active = ents.filter((e) => e.status === "active");
      return {
        email: (u.email ?? "").toLowerCase(),
        uid: u.uid,
        fechaRegistro: u.metadata.creationTime,
        disabled: u.disabled,
        accessStatus: active.map((e) => `${e.accessType}:${e.planCode}`).join("; ") || "—",
        entitlementsActivos: active.length,
        expedientesAsociados: ents.filter((e) => e.leaseProcessId).length,
      };
    });

    return NextResponse.json({
      success: true,
      features: {
        manualGrantPlus:
          process.env.NODE_ENV === "development" || process.env.ADMIN_INTERNAL_ENABLED === "true",
      },
      summary: {
        usersRegistered,
        surveysResponded: surveysCount,
        demoAccessesActive: demoActive,
        plusAccessesActive: plusActive,
        expedientesCreados: contractsCount,
        contractVersions: versionsCount,
        platformPaymentsApproved: paymentsApproved,
        contractsSigned,
        funnel,
        recentErrors: errorish.slice(0, 25),
      },
      surveys,
      users: usersWithAccess.slice(0, 500),
      accesses,
      platformOrders,
      platformPayments,
      expedientes,
      audit: auditRows,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("admin/dashboard", e);
    return NextResponse.json(
      {
        success: false,
        errors: [
          {
            field: "server",
            message: "No se pudo cargar el panel. Revise la consola del servidor o los índices de Firestore.",
          },
        ],
      },
      { status: 500 },
    );
  }
}
