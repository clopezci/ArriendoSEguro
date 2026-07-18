"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

export default function InventoryPreviewPage() {
  const id = String(useParams<{ id: string }>().id);
  const qs = useSearchParams();
  const inventoryId = qs.get("inventoryId") ?? "";
  const { state } = useDraftGuard(id);
  const { user } = useAuth();
  const [html, setHtml] = useState("");
  const [hash, setHash] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!inventoryId || !user) return;
      const res = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(inventoryId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.errors?.[0]?.message ?? "No se pudo cargar inventario.");
        return;
      }
      setHtml(data.inventory?.generatedHtml ?? "");
      setHash(data.inventory?.documentHash ?? "");
      setPdfUrl(data.inventory?.generatedPdfUrl ?? "");
    };
    void run();
  }, [inventoryId, user]);

  if (state !== "ready") return <p className="text-sm text-slate-700">Cargando...</p>;
  return (
    <WizardShell title="Reporte de inventario inicial del inmueble" currentStep={11} contractId={id} variant="extra" macroStep="acta" lean>
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      {!html ? (
        <p className="text-sm text-slate-700">El inventario aún no está completado.</p>
      ) : (
        <>
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4 text-slate-900">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <p className="mt-2 text-xs text-slate-600">Hash inventario: {hash}</p>
        </>
      )}
      <div className="mt-4 flex gap-3">
        <Link href={`/dashboard/contracts/${id}/inventory`} className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800">Volver</Link>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded border border-emerald-500 px-3 py-2 text-sm text-emerald-700">
            Descargar PDF
          </a>
        )}
      </div>
    </WizardShell>
  );
}

