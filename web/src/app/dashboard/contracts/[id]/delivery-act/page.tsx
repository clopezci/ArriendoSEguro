"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

export default function DeliveryActPage() {
  const id = String(useParams<{ id: string }>().id);
  const qs = useSearchParams();
  const inventoryId = qs.get("inventoryId") ?? "";
  const contractVersionId = qs.get("contractVersionId") ?? "";
  const { state } = useDraftGuard(id);
  const { user } = useAuth();
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [observations, setObservations] = useState("");
  const [html, setHtml] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  if (state !== "ready") return <p className="text-sm text-slate-700">Cargando...</p>;

  async function generateAct() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/delivery-act/generate", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ inventoryId, contractId: id, contractVersionId, observations, deliveryDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo generar acta.");
      const delivery = data.emailDelivery as "ok" | "partial" | "failed" | "none" | undefined;
      const mailMsg =
        delivery === "ok"
          ? " La enviamos por correo a ambas partes."
          : delivery === "partial"
            ? " La enviamos por correo a una de las partes (revisa el correo de la otra)."
            : delivery === "failed"
              ? " No pudimos enviarla por correo (revisa la configuración de correo o hazlo en modo prueba)."
              : "";
      setOk(`Acta de entrega generada y archivada como anexo.${mailMsg}`);
      const annex = await fetch(`/api/contracts/annexes/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(contractVersionId)}`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json());
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
    <WizardShell title="Acta de entrega inicial" currentStep={11} contractId={id} variant="extra" macroStep="acta" lean>
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      {ok && <p className="mb-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>}

      <p className="mb-3 text-sm text-slate-600">
        Último paso: confirma la <strong>fecha de entrega</strong>, agrega observaciones finales si las hay, y genera el
        acta. La enviaremos por correo a ambas partes y quedará archivada como anexo del expediente.
      </p>

      <label className="mb-3 block text-sm text-slate-800">
        <span className="mb-1 block">Fecha de entrega del inmueble</span>
        <input
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
      </label>

      <label className="block text-sm text-slate-800">
        <span className="mb-1 block">Observaciones finales (opcional)</span>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          className="min-h-24 w-full rounded border border-slate-300 bg-white p-3 text-sm text-slate-900"
          placeholder="Ej.: se entregan 2 juegos de llaves; la nevera queda con una marca previa registrada en las fotos."
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={generateAct} disabled={saving || !inventoryId || !contractVersionId} className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {saving ? "Generando y enviando..." : "Generar acta y enviar a las partes"}
        </button>
        <Link href={`/dashboard/contracts/${id}/inventory`} className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800">Volver a inventario</Link>
      </div>
      {html && (
        <div className="mt-4 max-h-[60vh] overflow-auto rounded border border-slate-300 bg-white p-4 text-slate-900">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded border border-emerald-500 px-3 py-2 text-xs text-emerald-700">
          Descargar PDF del acta
        </a>
      )}
    </WizardShell>
  );
}

