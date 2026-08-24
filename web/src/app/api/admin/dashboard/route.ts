import { NextResponse } from "next/server";
import type { UserRecord } from "firebase-admin/auth";
import { Timestamp, type QuerySnapshot } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { buildAdminSurveyRow } from "@/lib/validations/lead-form-export-labels";
import { summarizeGa4Detail } from "@/lib/observability/ga4";

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

    // Visitas GA4 (serie por día + desgloses). Best-effort: si no está configurado
    // o falla, viene con configured:false y el panel muestra la ayuda de setup.
    const ga4 = await summarizeGa4Detail().catch(() => null);

    // ————————————————————————————————————————————————————————————————
    // Indicadores LEAN (AARRR + ingresos + motores de crecimiento + serie
    // semanal para el bar chart race). Todo derivado de colecciones existentes;
    // best-effort (cada consulta puede fallar sin tumbar el panel).
    // ————————————————————————————————————————————————————————————————
    const NOW = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const toMs = (v: unknown): number | null => {
      if (v instanceof Timestamp) return v.toDate().getTime();
      if (typeof v === "string") { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
      return null;
    };

    const [payAllSnap, contractsAllSnap, leadsAllSnap, entLeanSnap, analyticsSnap, partyInvitesSnap, referralSnap, reviewsCount, marketingDoc] =
      await Promise.all([
        safeQueryDocs("payments_approved", () =>
          firestore.collection("platform_payments").where("status", "==", "APPROVED").limit(2000).get(),
        ),
        safeQueryDocs("contracts_all", () => firestore.collection("contracts").limit(2000).get()),
        safeQueryDocs("leads_all", () => firestore.collection("lead_forms").limit(2000).get()),
        safeQueryDocs("ent_lean", () => firestore.collection("access_entitlements").limit(500).get()),
        safeQueryDocs("analytics_events", () => firestore.collection("analytics_events").orderBy("at", "desc").limit(4000).get()),
        safeQueryDocs("party_invites", () => firestore.collection("party_invites").limit(3000).get()),
        safeQueryDocs("referral_codes", () => firestore.collection("referral_codes").limit(2000).get()),
        countSafe(() => firestore.collection("reputation_reviews").count().get()),
        firestore.collection("admin_config").doc("marketing").get().catch(() => null),
      ]);
    const partyInvitesCount = partyInvitesSnap?.size ?? null;
    const invitesAccepted = (partyInvitesSnap?.docs ?? []).filter((d) => Boolean((d.data() as Record<string, unknown>).completedAt)).length;
    const referralCodesCount = referralSnap?.size ?? null;
    const referralQualified = (referralSnap?.docs ?? []).reduce((a, d) => a + (Number((d.data() as Record<string, unknown>).qualifiedCount) || 0), 0);
    const marketingMonthlyCop = Number((marketingDoc?.data() as Record<string, unknown> | undefined)?.monthlyCop ?? 0) || 0;

    // Ingresos $ (COP). platform_payments.amount ya viene en pesos enteros.
    const payDates: number[] = [];
    let revenueTotal = 0;
    let revenue30 = 0;
    let paidCount = 0;
    const payerEmails = new Set<string>();
    (payAllSnap?.docs ?? []).forEach((d) => {
      const x = d.data() as Record<string, unknown>;
      const amt = Number(x.amount ?? 0) || 0;
      const at = toMs(x.approvedAt) ?? toMs(x.createdAtServer) ?? toMs(x.createdAt);
      revenueTotal += amt;
      paidCount += 1;
      if (at != null) { payDates.push(at); if (NOW - at <= 30 * DAY) revenue30 += amt; }
      const em = String(x.userEmail ?? "").toLowerCase();
      if (em) payerEmails.add(em);
    });
    const distinctPayers = payerEmails.size || paidCount;
    const revenue = {
      total: revenueTotal,
      last30: revenue30,
      count: paidCount,
      ticket: paidCount > 0 ? Math.round(revenueTotal / paidCount) : null,
      arpu: usersRegistered > 0 ? Math.round(revenueTotal / usersRegistered) : null,
      payers: distinctPayers,
    };

    // Retención: usuarios con 2+ expedientes (recurrentes) vía entitlements.
    const contractsByUser = new Map<string, number>();
    (entLeanSnap?.docs ?? []).forEach((d) => {
      const x = d.data() as Record<string, unknown>;
      const uid = String(x.userId ?? "");
      const lease = String(x.leaseProcessId ?? "");
      if (uid && lease) contractsByUser.set(uid, (contractsByUser.get(uid) ?? 0) + 1);
    });
    const repeatUsers = [...contractsByUser.values()].filter((c) => c >= 2).length;

    // Motor viral (aproximado): invitaciones por usuario registrado.
    const invitesPerUser = usersRegistered > 0 && partyInvitesCount != null
      ? Math.round((partyInvitesCount / usersRegistered) * 100) / 100
      : null;

    // LTV (auto-derivado): ticket × contratos por cliente PAGADOR.
    const payerUids = new Set<string>();
    (entLeanSnap?.docs ?? []).forEach((d) => {
      const x = d.data() as Record<string, unknown>;
      if (String(x.accessType ?? "") === "plus_paid" && String(x.userId ?? "")) payerUids.add(String(x.userId));
    });
    let ltv: number | null = null;
    if (payerUids.size > 0 && revenue.ticket != null) {
      let leases = 0;
      payerUids.forEach((u) => { leases += contractsByUser.get(u) ?? 0; });
      const perPayer = leases / payerUids.size;
      ltv = Math.round(revenue.ticket * Math.max(1, perPayer));
    }

    // Fechas de alta por usuario (Auth) para tiempo-a-convertir y cohortes.
    const userCreatedByUid = new Map<string, number>();
    const uidByEmail = new Map<string, string>();
    authUsers.forEach((u) => {
      const created = u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : NaN;
      if (Number.isFinite(created)) userCreatedByUid.set(u.uid, created);
      const em = (u.email ?? "").toLowerCase();
      if (em) uidByEmail.set(em, u.uid);
    });

    // Tiempo hasta convertir: primer pago por usuario − fecha de alta (días).
    const firstPayByUid = new Map<string, number>();
    (payAllSnap?.docs ?? []).forEach((d) => {
      const x = d.data() as Record<string, unknown>;
      const uid = uidByEmail.get(String(x.userEmail ?? "").toLowerCase());
      const at = toMs(x.approvedAt) ?? toMs(x.createdAtServer) ?? toMs(x.createdAt);
      if (uid && at != null) {
        const prev = firstPayByUid.get(uid);
        if (prev == null || at < prev) firstPayByUid.set(uid, at);
      }
    });
    const convDays: number[] = [];
    firstPayByUid.forEach((payAt, uid) => {
      const created = userCreatedByUid.get(uid);
      if (created != null && payAt >= created) convDays.push((payAt - created) / DAY);
    });
    const sortedConv = [...convDays].sort((a, b) => a - b);
    const timeToConvert = {
      avgDays: convDays.length ? Math.round((convDays.reduce((a, b) => a + b, 0) / convDays.length) * 10) / 10 : null,
      medianDays: sortedConv.length ? Math.round(sortedConv[Math.floor(sortedConv.length / 2)] * 10) / 10 : null,
      n: convDays.length,
    };

    // CAC (últimos 30 días) + relación LTV/CAC. Usa el gasto de marketing (config).
    const paidCount30 = payDates.filter((t) => NOW - t <= 30 * DAY).length;
    const cac = marketingMonthlyCop > 0 && paidCount30 > 0 ? Math.round(marketingMonthlyCop / paidCount30) : null;
    const ltvCac = cac != null && cac > 0 && ltv != null ? Math.round((ltv / cac) * 100) / 100 : null;

    // Coeficiente viral REAL: invitaciones por usuario × tasa de aceptación.
    const acceptanceRate = partyInvitesCount != null && partyInvitesCount > 0 ? invitesAccepted / partyInvitesCount : null;
    const viralK = invitesPerUser != null && acceptanceRate != null
      ? Math.round(invitesPerUser * acceptanceRate * 100) / 100
      : invitesPerUser;

    // Cohortes semanales (altas por semana) con su conversión posterior + semáforo.
    const activatedUids = new Set<string>(contractsByUser.keys());
    const weekKey = (ms: number): { key: string; order: number } => {
      const d = new Date(ms);
      const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
      const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
      const md = new Date(monday);
      return { key: `${String(md.getUTCDate()).padStart(2, "0")}/${String(md.getUTCMonth() + 1).padStart(2, "0")}`, order: Math.floor(monday / (7 * DAY)) };
    };
    const cohortMap = new Map<string, { order: number; size: number; activated: number; paid: number }>();
    authUsers.forEach((u) => {
      const created = u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : NaN;
      if (!Number.isFinite(created) || NOW - created > 8 * 7 * DAY) return;
      const { key, order } = weekKey(created);
      const c = cohortMap.get(key) ?? { order, size: 0, activated: 0, paid: 0 };
      c.size += 1;
      if (activatedUids.has(u.uid)) c.activated += 1;
      if (payerUids.has(u.uid)) c.paid += 1;
      cohortMap.set(key, c);
    });
    const cohortArr = [...cohortMap.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([week, c]) => ({
        week, size: c.size,
        activated: c.activated, activatedPct: c.size > 0 ? Math.round((c.activated / c.size) * 100) : 0,
        paid: c.paid, paidPct: c.size > 0 ? Math.round((c.paid / c.size) * 100) : 0,
      }));
    const cohorts = cohortArr.map((c, idx) => {
      const prev = cohortArr[idx - 1];
      let trend: "up" | "flat" | "down" | "na" = "na";
      if (prev) trend = c.activatedPct > prev.activatedPct + 2 ? "up" : c.activatedPct < prev.activatedPct - 2 ? "down" : "flat";
      return { ...c, trend };
    });

    // Serie semanal ACUMULADA (últimas 8 semanas) para el bar chart race.
    const contractDates: number[] = (contractsAllSnap?.docs ?? [])
      .map((d) => toMs((d.data() as Record<string, unknown>).createdAt))
      .filter((n): n is number => n != null);
    const leadDates: number[] = (leadsAllSnap?.docs ?? [])
      .map((d) => toMs((d.data() as Record<string, unknown>).createdAt))
      .filter((n): n is number => n != null);
    const signupDates: number[] = authUsers
      .map((u) => (u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : NaN))
      .filter((n) => Number.isFinite(n));
    const cumUpTo = (arr: number[], end: number) => arr.filter((t) => t <= end).length;
    const WEEKS = 8;
    const raceFrames = Array.from({ length: WEEKS }, (_, i) => {
      const end = NOW - (WEEKS - 1 - i) * 7 * DAY;
      const d = new Date(end);
      const label = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return {
        label,
        bars: [
          { key: "Encuestas", value: cumUpTo(leadDates, end) },
          { key: "Registros", value: cumUpTo(signupDates, end) },
          { key: "Contratos", value: cumUpTo(contractDates, end) },
          { key: "Compras", value: cumUpTo(payDates, end) },
        ],
      };
    });

    // Abandono (motivos) + embudo del asistente (drop-off), desde analytics_events.
    const REASON_LABELS: Record<string, string> = {
      solo_mirando: "Solo estaba mirando",
      equivocado: "Me equivoqué de sitio",
      no_es_lo_que_busco: "No es lo que buscaba",
      complicado: "Se me hizo complicado",
      precio: "Por el precio",
      falta_info: "Me faltó información",
      otro: "Otro",
    };
    const CANCEL_LABELS: Record<string, string> = {
      ya_no_necesito: "Ya no lo necesito",
      no_le_di_uso: "No le di uso",
      costoso: "Muy costoso",
      faltan_funciones: "Me faltaron funciones",
      problema: "Tuve un problema/error",
      otra_opcion: "Encontré otra opción",
      privacidad: "Privacidad / mis datos",
      otro: "Otro",
    };
    const evDocs = (analyticsSnap?.docs ?? []).map((d) => d.data() as Record<string, unknown>);
    const reasonCounts = new Map<string, number>();
    let pageAbandon = 0;
    let reasonGiven = 0;
    let dismissed = 0;
    const stepUsers = new Map<number, { step: string; anon: Set<string> }>();
    const reviewUsers = new Set<string>();
    const completedUsers = new Set<string>();
    const reachedPaymentUsers = new Set<string>();
    const cancelCounts = new Map<string, number>();
    for (const e of evDocs) {
      const name = String(e.name ?? "");
      const props = (e.props ?? {}) as Record<string, unknown>;
      const who = String(e.anonId ?? e.uid ?? "");
      if (name === "abandon_reason") {
        reasonGiven += 1;
        const r = String(props.reason ?? "otro");
        reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
      } else if (name === "page_abandon") pageAbandon += 1;
      else if (name === "abandon_dismissed") dismissed += 1;
      else if (name === "nuevo_step") {
        const idx = Number(props.index ?? -1);
        if (idx >= 0) {
          const cur = stepUsers.get(idx) ?? { step: String(props.step ?? idx), anon: new Set<string>() };
          if (who) cur.anon.add(who);
          stepUsers.set(idx, cur);
        }
      } else if (name === "nuevo_review") { if (who) reviewUsers.add(who); }
      else if (name === "nuevo_completed") { if (who) completedUsers.add(who); }
      else if (name === "reached_payment") { if (who) reachedPaymentUsers.add(who); }
      else if (name === "account_cancel_reason") {
        const r = String(props.reason ?? "otro");
        cancelCounts.set(r, (cancelCounts.get(r) ?? 0) + 1);
      }
    }
    const cancelReasons = [...cancelCounts.entries()]
      .map(([key, count]) => ({ key, label: CANCEL_LABELS[key] ?? key, count }))
      .sort((a, b) => b.count - a.count);
    const abandonReasons = [...reasonCounts.entries()]
      .map(([key, count]) => ({ key, label: REASON_LABELS[key] ?? key, count }))
      .sort((a, b) => b.count - a.count);
    const wizardFunnel = [...stepUsers.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, v]) => ({ index, step: v.step, users: v.anon.size }));
    const abandon = {
      pageAbandon,
      reasonGiven,
      dismissed,
      reasons: abandonReasons,
      wizard: wizardFunnel,
      wizardReview: reviewUsers.size,
      wizardCompleted: completedUsers.size,
      reachedPayment: reachedPaymentUsers.size,
      cancelReasons,
      hasData: evDocs.length > 0,
    };

    const lean = {
      northStar: contractsSigned,          // arriendos activos gestionados (firmados)
      abandon,
      acquisition: {
        visitors7d: ga4?.configured ? (ga4.daily.slice(-7).reduce((a, b) => a + b.users, 0)) : null,
        signups: usersRegistered,
        surveys: surveysCount,
      },
      activation: {
        contractsCreated: contractsCount,
        contractsGenerated: versionsCount,
        rate: pct(contractsCount, usersRegistered), // registros → contrato
      },
      retention: {
        repeatUsers,
        reviews: reviewsCount,
        repeatRate: pct(repeatUsers, usersRegistered),
      },
      revenue: { ...revenue, ltv },
      referral: {
        invitesSent: partyInvitesCount,
        invitesAccepted,
        acceptanceRate: acceptanceRate != null ? Math.round(acceptanceRate * 1000) / 10 : null,
        referralCodes: referralCodesCount,
        referralQualified,
        invitesPerUser,
      },
      engines: {
        viralK,                             // real: invitaciones/usuario × aceptación
        stickyRepeatRate: pct(repeatUsers, usersRegistered),
        paidTicket: revenue.ticket,
        ltv,
        cac,
        ltvCac,
      },
      timeToConvert,
      cohorts,
      marketing: { monthlyCop: marketingMonthlyCop },
      race: raceFrames,
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
        ga4,
        lean,
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
