import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getContractLifecycle } from "@/lib/contracts/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Expediente COMPLETO de un contrato para el admin: partes, versión, anexos,
 * documentos, firmas, pagos y estado. Solo admin interno. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!(await isInternalAdminEmailAsync(auth.user.email))) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, error: "server" }, { status: 503 });

  const id = new URL(request.url).searchParams.get("contractId") ?? "";
  if (!id) return NextResponse.json({ success: false, error: "missing_id" }, { status: 422 });

  const asArr = async (p: Promise<FirebaseFirestore.QuerySnapshot>) => {
    try { return (await p).docs.map((d) => d.data()); } catch { return []; }
  };

  const draftSnap = await firestore.collection("contract_drafts").doc(id).get().catch(() => null);
  const draft = (draftSnap?.data() as { ownerEmail?: string; payload?: Record<string, unknown> } | undefined) ?? {};
  const payload = (draft.payload ?? {}) as {
    landlord?: Record<string, unknown>;
    tenant?: Record<string, unknown>;
    solidaryCoDebtor?: Record<string, unknown>;
    property?: Record<string, unknown>;
    lease?: Record<string, unknown>;
  };

  const contractSnap = await firestore.collection("contracts").doc(id).get().catch(() => null);
  const versionId = (contractSnap?.data() as { currentVersionId?: string } | undefined)?.currentVersionId ?? null;

  let version: { versionNumber?: number; documentHash?: string } | null = null;
  if (versionId) {
    const vSnap = await firestore.collection("contract_versions").doc(versionId).get().catch(() => null);
    const v = vSnap?.data() as { versionNumber?: number; documentHash?: string } | undefined;
    if (v) version = { versionNumber: v.versionNumber, documentHash: v.documentHash };
  }

  const [annexes, signatures, propertyDocs, payments] = await Promise.all([
    asArr(firestore.collection("contract_annexes").where("contractId", "==", id).get()),
    asArr(firestore.collection("signatures").where("contractId", "==", id).get()),
    asArr(firestore.collection("property_documents").where("contractId", "==", id).get()),
    asArr(firestore.collection("platform_payments").where("orderId", "==", id).get()),
  ]);

  const lifecycle = await getContractLifecycle(firestore, id);

  return NextResponse.json({
    success: true,
    contract: {
      id,
      ownerEmail: draft.ownerEmail ?? "",
      landlord: payload.landlord ?? null,
      tenant: payload.tenant ?? null,
      codebtor: payload.solidaryCoDebtor ?? null,
      property: payload.property ?? null,
      lease: payload.lease ?? null,
      versionId,
      version,
      started: lifecycle.started,
      startedAt: lifecycle.startedAt ?? null,
    },
    annexes: annexes.map((a) => {
      const x = a as { title?: string; annexType?: string; status?: string; pdfUrl?: string | null };
      return { title: x.title ?? "", annexType: x.annexType ?? "", status: x.status ?? "", pdfUrl: x.pdfUrl ?? null };
    }),
    signatures: signatures.map((s) => {
      const x = s as { partyType?: string; signerEmail?: string; signatureStatus?: string; status?: string; signedAt?: string };
      return { partyType: x.partyType ?? "", signerEmail: x.signerEmail ?? "", status: x.signatureStatus ?? x.status ?? "", signedAt: x.signedAt ?? null };
    }),
    documents: propertyDocs.map((d) => {
      const x = d as { docType?: string; originalFilename?: string; fileName?: string };
      return { docType: x.docType ?? "", fileName: x.originalFilename ?? x.fileName ?? "" };
    }),
    payments: payments.map((p) => {
      const x = p as { amount?: number; status?: string; paymentMethod?: string; approvedAt?: string; createdAt?: string };
      return { amount: x.amount ?? 0, status: x.status ?? "", method: x.paymentMethod ?? "", at: x.approvedAt ?? x.createdAt ?? "" };
    }),
  });
}
