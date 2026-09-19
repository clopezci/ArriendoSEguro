"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Factor = { clave: string; nombre: string; estado: string; detalle?: string };
type Result = {
  approved: boolean;
  confianza?: number;
  nombreRegistrado?: string;
  cedulaVigente?: boolean;
  faceMatch?: boolean;
  liveness?: boolean;
  score?: number;
  factores?: Factor[];
  advertencias?: string[];
};

/** Reduce una imagen a JPEG (máx 1000px, calidad 0.82) para aligerar el envío. */
async function fileToDataUrl(file: File, maxDim = 1000, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("read"));
    fr.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("img"));
      im.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl; // si falla el resize, envía el original
  }
}

export function IdentityCheck() {
  const { user } = useAuth();
  const [cedula, setCedula] = useState("");
  const [fotoCedula, setFotoCedula] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setResult(null);
    if (!cedula.trim() || !fotoCedula || !selfie) {
      setErr("Cédula, foto de la cédula y selfie son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      const [foto, self] = await Promise.all([fileToDataUrl(fotoCedula), fileToDataUrl(selfie)]);
      const res = await fetch("/api/identity/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ cedula: cedula.replace(/\D/g, ""), fotoCedula: foto, selfie: self, nivel: "alto" }),
      });
      const json = (await res.json()) as { success?: boolean; result?: Result; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo verificar.");
      else setResult(json.result ?? null);
    } catch {
      setErr("Error de red al verificar.");
    } finally {
      setLoading(false);
    }
  }

  const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 text-xs text-slate-600">
        <p className="text-sm font-bold text-violet-900">Verificar identidad del inquilino</p>
        <p className="mt-1">Sube la cédula del inquilino y una selfie suya; el sistema valida el documento y que el rostro coincida (nivel alto). Útil para filtrar antes de firmar.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <input className={`${input} w-full`} placeholder="Número de cédula" value={cedula} onChange={(e) => setCedula(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            Foto de la cédula
            <input type="file" accept="image/*" onChange={(e) => setFotoCedula(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
          </label>
          <label className="text-xs text-slate-500">
            Selfie del inquilino
            <input type="file" accept="image/*" capture="user" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
          </label>
        </div>
        <button type="button" onClick={() => void run()} disabled={loading} className="rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {loading ? "Verificando…" : "Verificar identidad"}
        </button>
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>

      {result && (
        <div className={`rounded-2xl border p-4 text-sm ${result.approved ? "border-emerald-300 bg-emerald-50/50" : "border-rose-300 bg-rose-50/50"}`}>
          <p className={`text-base font-bold ${result.approved ? "text-emerald-700" : "text-rose-700"}`}>
            {result.approved ? "✅ Aprobado" : "⛔ No aprobado"}
            {typeof result.confianza === "number" && <span className="ml-2 text-xs font-normal text-slate-500">confianza {result.confianza}/100</span>}
          </p>
          {result.nombreRegistrado && <p className="mt-1 text-xs text-slate-600">Registraduría: <strong>{result.nombreRegistrado}</strong></p>}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {result.cedulaVigente !== undefined && <Badge ok={result.cedulaVigente} label="Cédula vigente" />}
            {result.faceMatch !== undefined && <Badge ok={result.faceMatch} label="Rostro coincide" />}
            {result.liveness !== undefined && <Badge ok={result.liveness} label="Prueba de vida" />}
            {typeof result.score === "number" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">similitud {(result.score * 100).toFixed(0)}%</span>}
          </div>
          {result.factores && result.factores.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {result.factores.map((f) => (
                <li key={f.clave} className="text-slate-600">
                  <span className={f.estado === "ok" ? "text-emerald-600" : "text-rose-600"}>●</span> {f.nombre}{f.detalle ? ` — ${f.detalle}` : ""}
                </li>
              ))}
            </ul>
          )}
          {result.advertencias && result.advertencias.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-700">⚠ {result.advertencias.join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-semibold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
      {ok ? "✓" : "✕"} {label}
    </span>
  );
}
