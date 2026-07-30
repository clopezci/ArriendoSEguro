import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, getUserRoleInContract } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

type Err = { success: false; errors: { field: string; message: string }[] };

/**
 * Autoriza a quien confirma el cierre: el DUEÑO del contrato. "Dueño" =
 * propietario del borrador (`contract_drafts.ownerUid`) O quien resuelve como
 * `landlord` por email en el contrato guardado. Antes solo se aceptaba el match
 * por email de `landlord`, y en el flujo /nuevo el correo de la cuenta no siempre
 * coincide con `contractPayload.landlord.email` → 403 y el checklist "revertía".
 */
async function requireContractOwner(
  request: Request,
  firestore: Firestore,
  contractId: string,
): Promise<
  | { ok: true; user: { uid: string; email: string } }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  const [cSnap, draftSnap, role] = await Promise.all([
    firestore.collection("contracts").doc(contractId).get(),
    firestore.collection("contract_drafts").doc(contractId).get(),
    getUserRoleInContract(firestore, auth.user.uid, auth.user.email, contractId),
  ]);
  if (!cSnap.exists) {
    return {
      ok: false,
      response: NextResponse.json<Err>(
        { success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] },
        { status: 404 },
      ),
    };
  }
  const ownerUid = (draftSnap.data() as { ownerUid?: string } | undefined)?.ownerUid;
  const isOwner = Boolean(ownerUid) && ownerUid === auth.user.uid;
  if (!isOwner && role !== "landlord") {
    return {
      ok: false,
      response: NextResponse.json<Err>(
        { success: false, errors: [{ field: "role", message: "Solo el dueño puede confirmar el cierre." }] },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user: { uid: auth.user.uid, email: auth.user.email } };
}

/**
 * Checklist de cierre de "Termina tu contrato". El DUEÑO es el responsable de
 * confirmar que cada punto está listo (o que no aplica): documentos, condiciones
 * de pago y alertas. Solo cuando confirma los tres se habilita «Administra tu
 * arriendo». Se guarda en el doc `contracts`, así que es cross-device.
 */
type Checklist = { documentos: boolean; pago: boolean; alertas: boolean };

function readChecklist(data: unknown): Checklist {
  const c = ((data as { terminationChecklist?: Partial<Checklist> } | undefined)?.terminationChecklist) ?? {};
  return {
    documentos: c.documentos === true,
    pago: c.pago === true,
    alertas: c.alertas === true,
  };
}

function unavailable() {
  return NextResponse.json<Err>(
    { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return unavailable();
  const contractId = new URL(request.url).searchParams.get("contractId") ?? "";
  if (!contractId) {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "contractId", message: "Falta contractId." }] }, { status: 422 });
  }
  const owner = await requireContractOwner(request, firestore, contractId);
  if (!owner.ok) return owner.response;

  const snap = await firestore.collection("contracts").doc(contractId).get();
  return NextResponse.json({ success: true, checklist: readChecklist(snap.data()) });
}

const schema = z.object({
  contractId: z.string().min(3),
  step: z.enum(["documentos", "pago", "alertas"]),
  value: z.boolean(),
});

export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return unavailable();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }
  const { contractId, step, value } = parsed.data;
  const owner = await requireContractOwner(request, firestore, contractId);
  if (!owner.ok) return owner.response;

  const ref = firestore.collection("contracts").doc(contractId);
  await ref.set(
    {
      terminationChecklist: { [step]: value },
      updatedAt: new Date().toISOString(),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const snap = await ref.get();
  auditEvent("termination_checklist_updated", { contractId, step, value });
  return NextResponse.json({ success: true, checklist: readChecklist(snap.data()) });
}
