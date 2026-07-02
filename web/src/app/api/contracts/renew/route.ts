import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { getLegalConfig } from "@/domain/legal/legalConfig";
import { renderRenewalAddendum } from "@/domain/contracts/renderRenewalAddendum";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";
import { persistContractPdfAsset } from "@/domain/contracts/persistContractPdfAsset";
import { sendEmail } from "@/services/email/sendEmail";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  mode: z.enum(["auto", "custom"]).default("auto"),
  newStartDate: z.string().optional(),
  newEndDate: z.string().optional(),
  newMonthlyRent: z.number().positive().optional(),
  newMonthlyRentText: z.string().max(200).optional(),
});

type Party = { fullName?: string; email?: string };
type VersionDoc = {
  contractId?: string;
  contractPayload?: {
    landlord?: Party;
    tenant?: Party;
    solidaryCoDebtor?: Party;
    solidaryCoDebtors?: Party[];
    property?: { address?: string };
    lease?: {
      monthlyRent?: number;
      monthlyRentText?: string;
      startDate?: string;
      endDate?: string;
      termMonths?: number;
    };
  };
};

function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function isoAddMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}
function fmtEsCo(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}
function money(n: number): string {
  return `$${Math.round(n || 0).toLocaleString("es-CO")}`;
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }
    const { contractId, contractVersionId, mode } = parsed.data;
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }

    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!participant.ok) return participant.response;

    const [contractSnap, versionSnap] = await Promise.all([
      firestore.collection("contracts").doc(contractId).get(),
      firestore.collection("contract_versions").doc(contractVersionId).get(),
    ]);
    if (!contractSnap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
    }
    const contract = contractSnap.data() as { status?: string; draftId?: string } | undefined;
    // Solo se renueva un contrato ACTIVO (firmado).
    if (contract?.status !== "signed") {
      return NextResponse.json(
        { success: false, errors: [{ field: "status", message: "Solo puedes renovar un contrato que ya está firmado (activo)." }] },
        { status: 422 },
      );
    }
    const version = versionSnap.data() as VersionDoc | undefined;
    if (!versionSnap.exists || version?.contractId !== contractId || !version?.contractPayload) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "Versión contractual inválida." }] }, { status: 422 });
    }

    const payload = version.contractPayload;
    const lease = payload.lease ?? {};
    const oldRent = Number(lease.monthlyRent ?? 0);
    const oldStart = String(lease.startDate ?? "");
    const oldEnd = String(lease.endDate ?? "");
    const termMonths = Number(lease.termMonths ?? 12) || 12;

    const config = await getLegalConfig(firestore);
    const ipcPercent = config.ipcPercent;

    // Cálculo automático ("dejar todo igual"): fechas del nuevo período + reajuste IPC.
    const autoNewStart = oldEnd ? isoAddDays(oldEnd, 1) : "";
    const autoNewEnd = autoNewStart ? isoAddMonths(autoNewStart, termMonths) : "";
    const autoNewRent = Math.round(oldRent * (1 + ipcPercent / 100));

    const newStart = (mode === "custom" && parsed.data.newStartDate) || autoNewStart;
    const newEnd = (mode === "custom" && parsed.data.newEndDate) || autoNewEnd;
    const newRent = mode === "custom" && parsed.data.newMonthlyRent ? Math.round(parsed.data.newMonthlyRent) : autoNewRent;
    const newRentText = (parsed.data.newMonthlyRentText || "").trim() || `${money(newRent)} (valor en cifras)`;
    // % efectivo del reajuste para el documento (por si el usuario editó el canon).
    const effectivePct = oldRent > 0 ? Math.round(((newRent / oldRent) - 1) * 1000) / 10 : ipcPercent;

    const codebtors = (payload.solidaryCoDebtors && payload.solidaryCoDebtors.length > 0
      ? payload.solidaryCoDebtors
      : payload.solidaryCoDebtor
        ? [payload.solidaryCoDebtor]
        : []) as Party[];

    const rendered = renderRenewalAddendum({
      addendumDate: fmtEsCo(new Date().toISOString().slice(0, 10)),
      originalContractId: contractId,
      propertyAddress: payload.property?.address ?? "el inmueble arrendado",
      landlordName: payload.landlord?.fullName ?? "Arrendador",
      tenantName: payload.tenant?.fullName ?? "Arrendatario",
      codebtorNames: codebtors.map((c) => c.fullName ?? "").filter(Boolean),
      previousStart: fmtEsCo(oldStart),
      previousEnd: fmtEsCo(oldEnd),
      newStart: fmtEsCo(newStart),
      newEnd: fmtEsCo(newEnd),
      termMonths,
      previousRent: money(oldRent),
      newRent: money(newRent),
      newRentText,
      ipcPercent: effectivePct,
    });

    // Secuencia de renovación (permite varias en el tiempo).
    const existing = await firestore
      .collection("contract_annexes")
      .where("contractId", "==", contractId)
      .where("annexType", "==", "renewal_addendum")
      .get();
    const seq = existing.size + 1;
    const annexId = `annex_renewal_${contractId}_${seq}`;
    const generatedAt = new Date().toISOString();

    const pdfBytes = await renderContractPdfFromHtml({
      html: rendered.html,
      contractId,
      contractVersionId,
      versionNumber: seq,
      documentHash: rendered.hash,
      generatedAt,
    });
    const persisted = await persistContractPdfAsset({
      pdfBytes: Buffer.from(pdfBytes),
      storageObjectPath: `contracts/${contractId}/annexes/${annexId}.pdf`,
      annexFirestoreDocId: annexId,
    });

    await firestore.collection("contract_annexes").doc(annexId).set({
      id: annexId,
      contractId,
      contractVersionId,
      leaseProcessId: contract?.draftId ?? contractId,
      annexType: "renewal_addendum",
      title: `Otrosí de prórroga y reajuste No. ${seq}`,
      status: "generated",
      htmlContent: rendered.html,
      pdfUrl: persisted.pdfUrl,
      pdfStoragePath: persisted.pdfStoragePath,
      documentHash: rendered.hash,
      renewalNewStart: newStart,
      renewalNewEnd: newEnd,
      renewalNewRent: newRent,
      createdAt: generatedAt,
      updatedAt: generatedAt,
      generatedAt,
    });

    await firestore.collection("contracts").doc(contractId).set(
      {
        renewalCount: seq,
        lastRenewalAt: generatedAt,
        renewedThrough: newEnd,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    auditEvent("contract_renewed", { contractId, seq, ipcPercent: effectivePct, newRent });

    // Envío a todas las partes (best-effort).
    const recipients = Array.from(
      new Set(
        [payload.landlord?.email, payload.tenant?.email, ...codebtors.map((c) => c.email)]
          .filter(Boolean)
          .map((e) => String(e).trim().toLowerCase()),
      ),
    );
    const linkLine =
      persisted.pdfUrl && persisted.pdfUrl.startsWith("http")
        ? `<p>Documento (otrosí de renovación): <a href="${persisted.pdfUrl}">Descargar PDF</a></p>`
        : `<p>El otrosí de renovación quedó archivado como anexo del contrato en ArriendoSeguro.</p>`;
    const html =
      `<p>Hola,</p>` +
      `<p>El contrato de arrendamiento del inmueble en <strong>${payload.property?.address ?? "el inmueble arrendado"}</strong> ` +
      `fue <strong>renovado</strong>. Se generó un <strong>otrosí de prórroga y reajuste</strong> con estas condiciones:</p>` +
      `<ul>` +
      `<li>Nuevo período: <strong>${fmtEsCo(newStart)}</strong> a <strong>${fmtEsCo(newEnd)}</strong> (${termMonths} meses).</li>` +
      `<li>Nuevo canon: <strong>${money(newRent)}</strong> (reajuste ${effectivePct}% — Ley 820, art. 20).</li>` +
      `</ul>` +
      linkLine +
      `<p style="color:#64748b;font-size:12px;">Enviado por ArriendoSeguro. Las demás condiciones del contrato original siguen vigentes.</p>`;
    let emailDelivery: "ok" | "partial" | "failed" | "none" = "none";
    if (recipients.length > 0) {
      const results = await Promise.all(
        recipients.map((to) =>
          sendEmail({
            to,
            subject: "Tu contrato de arriendo fue renovado — ArriendoSeguro",
            html,
            text: `Contrato renovado. Nuevo período ${fmtEsCo(newStart)} a ${fmtEsCo(newEnd)}; nuevo canon ${money(newRent)} (reajuste ${effectivePct}%).`,
            templateCode: "contractRenewalDocEmail",
            relatedEntityType: "contract",
            relatedEntityId: contractId,
          }).then((r) => r.status === "sent" || r.status === "mock", () => false),
        ),
      );
      const okCount = results.filter(Boolean).length;
      emailDelivery = okCount === 0 ? "failed" : okCount === results.length ? "ok" : "partial";
    }

    return NextResponse.json({
      success: true,
      annexId,
      pdfUrl: persisted.pdfUrl,
      emailDelivery,
      renewal: { newStart, newEnd, newRent, termMonths, ipcPercent: effectivePct },
    });
  } catch (err) {
    await logServerError("contracts/renew", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo renovar el contrato." }] }, { status: 500 });
  }
}
