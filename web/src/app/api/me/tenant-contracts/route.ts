import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { USER_LANDLORD_PROFILES_COLLECTION } from "@/domain/saved-entities/savedEntities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Normaliza un documento para comparar (sin puntos, espacios ni mayúsculas). */
function normDoc(v: unknown): string {
  return String(v ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

type PartyLite = { email?: string; documentNumber?: string; fullName?: string };
type VersionPayload = {
  tenant?: PartyLite;
  solidaryCoDebtor?: PartyLite;
  solidaryCoDebtors?: PartyLite[];
  property?: { address?: string };
  landlord?: { fullName?: string };
};

/**
 * Contratos donde el usuario autenticado es INQUILINO (o codeudor). Alimenta la
 * vista "Ver como inquilino". Antes solo casaba por CORREO, así que si el DUEÑO
 * llenaba los datos del inquilino con un correo distinto al de su cuenta, el
 * contrato no aparecía. Ahora también casa por NÚMERO DE DOCUMENTO: reunimos los
 * documentos conocidos del usuario (su perfil + los contratos que ya casan por
 * correo) y con ellos rescatamos los demás contratos.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: true, contracts: [] });

  const email = (auth.user.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ success: true, contracts: [] });

  // Documentos conocidos del usuario: su perfil guardado (por uid).
  const myDocs = new Set<string>();
  try {
    const profSnap = await firestore.collection(USER_LANDLORD_PROFILES_COLLECTION).doc(auth.user.uid).get();
    const pd = normDoc((profSnap.data() as { documentNumber?: string } | undefined)?.documentNumber);
    if (pd) myDocs.add(pd);
  } catch {
    /* sin perfil: seguimos solo con correo + documentos hallados por correo */
  }

  let snap;
  try {
    snap = await firestore.collection("contract_versions").limit(800).get();
  } catch {
    return NextResponse.json({ success: true, contracts: [] });
  }

  type Entry = { contractId: string; address: string; landlordName: string; role: "tenant" | "codebtor" };
  const byContract = new Map<string, Entry>();

  // Roles del usuario en un payload, con match por correo o por documento.
  const roleInPayload = (p: VersionPayload): "tenant" | "codebtor" | null => {
    const tenantEmail = (p.tenant?.email ?? "").trim().toLowerCase();
    const tenantDoc = normDoc(p.tenant?.documentNumber);
    if ((tenantEmail && tenantEmail === email) || (tenantDoc && myDocs.has(tenantDoc))) return "tenant";
    const codebtors = [p.solidaryCoDebtor, ...(p.solidaryCoDebtors ?? [])].filter(Boolean) as PartyLite[];
    for (const c of codebtors) {
      const ce = (c.email ?? "").trim().toLowerCase();
      const cd = normDoc(c.documentNumber);
      if ((ce && ce === email) || (cd && myDocs.has(cd))) return "codebtor";
    }
    return null;
  };

  const record = (contractId: string, p: VersionPayload, role: "tenant" | "codebtor") => {
    if (!contractId || byContract.has(contractId)) return;
    byContract.set(contractId, {
      contractId,
      address: p.property?.address ?? "Inmueble",
      landlordName: p.landlord?.fullName ?? "",
      role,
    });
  };

  // Paso 1: match por CORREO y, de paso, aprende los documentos del usuario
  // (los de la parte que casó por correo), para el paso por documento.
  const rows = snap.docs.map((doc) => {
    const d = doc.data() as { contractId?: string; contractPayload?: VersionPayload };
    return { contractId: d.contractId ?? "", p: d.contractPayload ?? {} };
  });
  for (const { contractId, p } of rows) {
    const tenantEmail = (p.tenant?.email ?? "").trim().toLowerCase();
    if (tenantEmail && tenantEmail === email) {
      const dn = normDoc(p.tenant?.documentNumber);
      if (dn) myDocs.add(dn);
      record(contractId, p, "tenant");
      continue;
    }
    const codebtors = [p.solidaryCoDebtor, ...(p.solidaryCoDebtors ?? [])].filter(Boolean) as PartyLite[];
    const meAsCod = codebtors.find((c) => (c.email ?? "").trim().toLowerCase() === email);
    if (meAsCod) {
      const dn = normDoc(meAsCod.documentNumber);
      if (dn) myDocs.add(dn);
      record(contractId, p, "codebtor");
    }
  }

  // Paso 2: con los documentos ya conocidos, rescata contratos donde el dueño
  // usó un correo distinto pero el MISMO documento del inquilino/codeudor.
  if (myDocs.size > 0) {
    for (const { contractId, p } of rows) {
      if (byContract.has(contractId)) continue;
      const role = roleInPayload(p);
      if (role) record(contractId, p, role);
    }
  }

  return NextResponse.json({ success: true, contracts: Array.from(byContract.values()) });
}
