import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contratos donde el usuario autenticado es INQUILINO (o codeudor), buscando por
 * su correo en las versiones de contrato. Alimenta la vista "Ver como inquilino":
 * ahí el inquilino ve sus arriendos y puede reportar daños, ver pagos, etc.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: true, contracts: [] });

  const email = (auth.user.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ success: true, contracts: [] });

  // Escaneo de versiones recientes y filtro por correo del inquilino/codeudor.
  // (Volumen bajo; evita índices compuestos por campos anidados.)
  let snap;
  try {
    snap = await firestore.collection("contract_versions").limit(800).get();
  } catch {
    return NextResponse.json({ success: true, contracts: [] });
  }

  const byContract = new Map<string, { contractId: string; address: string; landlordName: string; role: "tenant" | "codebtor" }>();
  for (const doc of snap.docs) {
    const d = doc.data() as {
      contractId?: string;
      contractPayload?: {
        tenant?: { email?: string };
        solidaryCoDebtor?: { email?: string };
        solidaryCoDebtors?: { email?: string }[];
        property?: { address?: string };
        landlord?: { fullName?: string };
      };
    };
    const p = d.contractPayload ?? {};
    const tenantEmail = (p.tenant?.email ?? "").trim().toLowerCase();
    const codebtorEmails = [p.solidaryCoDebtor?.email, ...(p.solidaryCoDebtors ?? []).map((c) => c?.email)]
      .map((e) => (e ?? "").trim().toLowerCase())
      .filter(Boolean);
    const contractId = d.contractId ?? "";
    if (!contractId) continue;
    const role: "tenant" | "codebtor" | null = tenantEmail === email ? "tenant" : codebtorEmails.includes(email) ? "codebtor" : null;
    if (!role) continue;
    // Nos quedamos con una entrada por contrato.
    if (!byContract.has(contractId)) {
      byContract.set(contractId, {
        contractId,
        address: p.property?.address ?? "Inmueble",
        landlordName: p.landlord?.fullName ?? "",
        role,
      });
    }
  }

  return NextResponse.json({ success: true, contracts: Array.from(byContract.values()) });
}
