"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";

export default function DeliveryActPage() {
  const id = String(useParams<{ id: string }>().id);
  const qs = useSearchParams();
  const inventoryId = qs.get("inventoryId") ?? "";
  const contractVersionId = qs.get("contractVersionId") ?? "";
  const { state } = useDraftGuard(id);
  const [observations, setObservations] = useState("");
  const [html, setHtml] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  if (state !== "ready") return <p className="text-sm text-slate-300">Cargando...</p>;

  async function generateAct() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/delivery-act/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId, contractId: id, contractVersionId, observations }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo generar acta.");
      setOk("Acta de entrega generada y asociada como anexo.");
      const annex = await fetch(`/api/contracts/annexes/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(contractVersionId)}`).then((r) => r.json());
      const found = (annex?.annexes ?? []).find((a: { annexType?: string }) => a.annexType === "initial_delivery_act");
      setHtml(found?.htmlContent ?? "");
      setPdfUrl(found?.pdfUrl ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar acta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardShell title="Acta de entrega inicial" currentStep={10} contractId={id}>
      {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}
      {ok && <p className="mb-3 text-sm text-emerald-300">{ok}</p>}
      <textarea
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
        className="min-h-24 w-full rounded border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100"
        placeholder="Observaciones generales"
      />
      <div className="mt-3 flex gap-3">
        <button type="button" onClick={generateAct} disabled={saving || !inventoryId || !contractVersionId} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">
          {saving ? "Generando..." : "Generar acta de entrega"}
        </button>
        <Link href={`/dashboard/contracts/${id}/inventory`} className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200">Volver a inventario</Link>
      </div>
      {html && (
        <div className="mt-4 max-h-[60vh] overflow-auto rounded border border-slate-700 bg-white p-4 text-slate-900">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded border border-emerald-600 px-3 py-2 text-xs text-emerald-200">
          Descargar PDF del acta
        </a>
      )}
    </WizardShell>
  );
}

