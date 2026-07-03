import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    const contractVersionId = url.searchParams.get("contractVersionId") ?? "";
    if (!contractId || !contractVersionId) {
      return NextResponse.json(
        { success: false, errors: [{ field: "query", message: "contractId y contractVersionId son obligatorios." }] },
        { status: 422 },
      );
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: true, signatures: [] });

    const snap = await firestore
      .collection("signatures")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .get();

    type Row = {
      id: string;
      partyType: string;
      signerName: string;
      signerEmail: string;
      signatureStatus: string;
      sentAt: string | null;
      signedAt: string | null;
      createdAt: string | null;
    };

    const rows: Row[] = snap.docs.map((d) => {
      const s = d.data() as {
        partyType: string;
        signerName: string;
        signerEmail: string;
        signatureStatus: string;
        sentAt?: string;
        signedAt?: string;
        createdAt?: string;
      };
      return {
        id: d.id,
        partyType: s.partyType,
        signerName: s.signerName,
        signerEmail: s.signerEmail,
        signatureStatus: s.signatureStatus,
        sentAt: s.sentAt ?? null,
        signedAt: s.signedAt ?? null,
        createdAt: s.createdAt ?? null,
      };
    });

    // Deduplicación por parte: rondas de firma repetidas (o reintentos) pudieron
    // crear varias filas para la misma parte. Mostramos UNA por `partyType`:
    // se descartan las canceladas y, entre las restantes, se prefiere la firmada
    // y, si ninguna, la más reciente. Así el conteo "X de N" es correcto.
    const recency = (r: Row) => r.signedAt ?? r.sentAt ?? r.createdAt ?? "";
    const isBetter = (candidate: Row, current: Row): boolean => {
      const candSigned = candidate.signatureStatus === "signed";
      const curSigned = current.signatureStatus === "signed";
      if (candSigned !== curSigned) return candSigned; // firmada gana
      return recency(candidate) > recency(current); // si empatan, la más reciente
    };
    const byParty = new Map<string, Row>();
    for (const r of rows) {
      if (r.signatureStatus === "cancelled") continue;
      const cur = byParty.get(r.partyType);
      if (!cur || isBetter(r, cur)) byParty.set(r.partyType, r);
    }

    const signatures = [...byParty.values()].map((r) => ({
      id: r.id,
      partyType: r.partyType,
      signerName: r.signerName,
      signerEmail: r.signerEmail,
      signatureStatus: r.signatureStatus,
      sentAt: r.sentAt,
      signedAt: r.signedAt,
    }));
    return NextResponse.json({ success: true, signatures });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo listar firmas." }] },
      { status: 500 },
    );
  }
}

