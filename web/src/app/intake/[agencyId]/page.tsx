"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

export default function IntakePage() {
  const params = useParams<{ agencyId: string }>();
  const agencyId = params.agencyId;
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [identityEnabled, setIdentityEnabled] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({ fullName: "", documentType: "CC", documentNumber: "", city: "", email: "", phone: "", propertyHint: "", note: "" });
  const [fotoCedula, setFotoCedula] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  const loadAgency = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/agency/${agencyId}`);
      if (!res.ok) { setNotFound(true); return; }
      const json = (await res.json()) as { success?: boolean; name?: string; identityEnabled?: boolean };
      if (json?.success) {
        setAgencyName(json.name ?? "la agencia");
        setIdentityEnabled(json.identityEnabled !== false);
      } else setNotFound(true);
    } catch {
      setNotFound(true);
    }
  }, [agencyId]);

  useEffect(() => {
    void loadAgency();
  }, [loadAgency]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setErr(null);
    if (!form.fullName.trim() || !form.documentNumber.trim() || !form.city.trim() || !form.email.trim() || !form.phone.trim()) {
      setErr("Completa nombre, documento, ciudad, correo y teléfono.");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (fotoCedula && selfie) {
        const [foto, self] = await Promise.all([fileToDataUrl(fotoCedula), fileToDataUrl(selfie)]);
        payload.fotoCedula = foto;
        payload.selfie = self;
      }
      const res = await fetch(`/api/public/agency/${agencyId}/intake`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo enviar. Intenta de nuevo.");
      else setDone(true);
    } catch {
      setErr("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  if (notFound) {
    return <main className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-600">Este enlace no está disponible.</main>;
  }

  if (done) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">¡Datos enviados!</h1>
        <p className="mt-2 text-sm text-slate-600">Gracias. {agencyName ?? "La agencia"} recibió tu información y te contactará para continuar con el contrato.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <p className="text-xs uppercase tracking-wide text-violet-600">Solicitud de arrendamiento</p>
      <h1 className="text-xl font-bold text-slate-900">{agencyName ?? "…"}</h1>
      <p className="mt-1 text-sm text-slate-600">Completa tus datos para agilizar tu contrato de arriendo. Solo toma un minuto.</p>

      <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input className={input} placeholder="Nombre completo" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        <div className="flex gap-2">
          <select className={`${input} w-24`} value={form.documentType} onChange={(e) => set("documentType", e.target.value)}>
            <option value="CC">CC</option>
            <option value="CE">CE</option>
            <option value="PA">PA</option>
          </select>
          <input className={input} placeholder="Número de documento" value={form.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} />
        </div>
        <input className={input} placeholder="Ciudad" value={form.city} onChange={(e) => set("city", e.target.value)} />
        <input className={input} placeholder="Correo electrónico" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <input className={input} placeholder="Celular (WhatsApp)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <input className={input} placeholder="¿Qué inmueble te interesa? (opcional)" value={form.propertyHint} onChange={(e) => set("propertyHint", e.target.value)} />
        <textarea className={input} rows={2} placeholder="Mensaje (opcional)" value={form.note} onChange={(e) => set("note", e.target.value)} />

        {identityEnabled && (
        <div className="rounded-xl border border-dashed border-slate-300 p-3">
          <p className="text-xs font-semibold text-slate-500">Verificación (opcional, agiliza tu aprobación)</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">Foto de tu cédula
              <input type="file" accept="image/*" onChange={(e) => setFotoCedula(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
            </label>
            <label className="text-xs text-slate-500">Selfie
              <input type="file" accept="image/*" capture="user" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
            </label>
          </div>
        </div>
        )}

        <button type="button" onClick={() => void submit()} disabled={loading} className="w-full rounded-lg bg-[#5646E5] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {loading ? "Enviando…" : "Enviar mis datos"}
        </button>
        {err && <p className="text-xs text-rose-600">{err}</p>}
        <p className="text-[11px] text-slate-400">Tus datos se usan solo para tu proceso de arrendamiento con {agencyName ?? "la agencia"}.</p>
      </div>
    </main>
  );
}
