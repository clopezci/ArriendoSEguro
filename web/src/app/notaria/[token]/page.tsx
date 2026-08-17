"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TenantPromoFooter } from "@/components/marketing/tenant-promo-footer";

/**
 * Página PÚBLICA (sin cuenta) para que el inquilino firme y autentique el contrato
 * con la firma digital gratuita del Estado (Agencia Nacional Digital) y suba el PDF
 * ya firmado al contrato. El acceso lo da el TOKEN del enlace que compartió el
 * dueño. Solo autoriza dos acciones acotadas: descargar el contrato y subir el PDF.
 */
type ShareInfo = {
  contractId: string;
  contractVersionId: string;
  role: string;
  roleLabel: string;
  inviteeName: string;
  propertyLabel: string;
  expired: boolean;
  alreadyUploaded: boolean;
  lastUploadedAt: string | null;
};

export default function NotariaSharePage() {
  const token = String(useParams<{ token: string }>().token);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [dlBusy, setDlBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr("");
    try {
      const res = await fetch(`/api/contracts/notarial/share?token=${encodeURIComponent(token)}`);
      const j = (await res.json()) as { success?: boolean; share?: ShareInfo; errors?: { message?: string }[] };
      if (!res.ok || !j.success || !j.share) {
        setLoadErr(j.errors?.[0]?.message ?? "El enlace no es válido.");
        setInfo(null);
        return;
      }
      setInfo(j.share);
      setDone(Boolean(j.share.alreadyUploaded));
    } catch {
      setLoadErr("No se pudo conectar. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function downloadContract() {
    if (!info) return;
    setDlBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/contracts/pdf/${encodeURIComponent(info.contractVersionId)}?shareToken=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setMsg(res.status === 404 ? "El dueño aún no ha generado el PDF del contrato. Pídeselo por este medio." : "No se pudo descargar el contrato.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato-${info.contractVersionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Error de red al descargar el contrato.");
    } finally {
      setDlBusy(false);
    }
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!info) return;
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMsg("Selecciona el PDF firmado.");
      return;
    }
    setUpBusy(true);
    setMsg("");
    try {
      const body = new FormData();
      body.set("contractId", info.contractId);
      body.set("contractVersionId", info.contractVersionId);
      body.set("shareToken", token);
      body.set("file", file);
      const res = await fetch("/api/contracts/notarial/upload", { method: "POST", body });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo subir el PDF. Verifica que sea el archivo firmado.");
        return;
      }
      setDone(true);
      setMsg("");
      (e.target as HTMLFormElement).reset();
    } catch {
      setMsg("Error de red al subir el PDF.");
    } finally {
      setUpBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#3FD98A,#12B886)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />

      <div className="relative z-10 mx-auto max-w-xl px-6 py-8">
        <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">ArriendoSeguro · Firma digital del Estado</span>
        <h1 className="mt-4 text-balance text-3xl font-extrabold tracking-tight">Firma y autentica tu contrato (gratis)</h1>

        {loading && <p className="mt-6 text-sm text-slate-600">Cargando…</p>}

        {!loading && loadErr && (
          <div className="mt-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
            {loadErr} Pídele al dueño que te comparta un enlace nuevo.
          </div>
        )}

        {!loading && info && (
          <>
            <p className="mt-3 text-slate-600">
              Hola{info.inviteeName ? ` ${info.inviteeName.split(" ")[0]}` : ""}, el dueño te invitó a firmar el contrato del inmueble
              {info.propertyLabel ? <> <b>{info.propertyLabel}</b></> : ""} con la <b>firma digital gratuita del Estado</b> (Agencia Nacional Digital) y a subirlo aquí. No necesitas crear cuenta.
            </p>

            {info.expired ? (
              <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Este enlace ya venció. Pídele al dueño que te comparta uno nuevo.
              </div>
            ) : done ? (
              <div className="mt-6 rounded-3xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-6 text-emerald-800">
                <p className="text-lg font-bold">¡Listo! Recibimos tu PDF firmado ✓</p>
                <p className="mt-1 text-sm">Quedó guardado en el contrato. Ya puedes cerrar esta página. Si te equivocaste de archivo, súbelo de nuevo abajo.</p>
                <button onClick={() => setDone(false)} className="mt-3 text-sm font-semibold text-[#0B6E4E] underline">Subir otro archivo</button>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {/* Paso 1 */}
                <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5">
                  <p className="text-sm font-bold text-slate-900">1) Descarga el contrato</p>
                  <p className="mt-1 text-xs text-slate-600">Es el PDF que vas a firmar con el Estado.</p>
                  <button
                    onClick={() => void downloadContract()}
                    disabled={dlBusy}
                    className="mt-3 w-full rounded-2xl border-2 border-[#5646E5] px-4 py-3 text-sm font-bold text-[#5646E5] transition hover:bg-[#5646E5]/5 disabled:opacity-60"
                  >
                    {dlBusy ? "Descargando…" : "⬇️ Descargar contrato (PDF)"}
                  </button>
                </section>

                {/* Paso 2 */}
                <section className="rounded-3xl border-2 border-emerald-300 bg-emerald-50/70 p-5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">GRATIS</span>
                    <p className="text-sm font-bold text-emerald-950">2) Fírmalo con el Estado</p>
                  </div>
                  <ol className="mt-2 space-y-1.5 pl-5 text-xs text-slate-700 [list-style:decimal]">
                    <li>Entra al portal de la Agencia Nacional Digital, regístrate y sube el contrato que descargaste.</li>
                    <li>Confirma con el <b>código (OTP) que llega a tu correo</b> y descarga el PDF ya firmado.</li>
                  </ol>
                  <a
                    href="https://firmaautenticaciondigital.and.gov.co/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex rounded-xl bg-[#5646E5] px-3 py-2 text-sm font-medium text-white hover:brightness-105"
                  >
                    Ir a Firma y Autenticación Digital (Estado) →
                  </a>
                </section>

                {/* Paso 3 */}
                <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5">
                  <p className="text-sm font-bold text-slate-900">3) Sube aquí el PDF firmado</p>
                  <p className="mt-1 text-xs text-slate-600">Con un clic queda guardado en el contrato. Solo PDF, hasta 15 MB.</p>
                  <form className="mt-3 space-y-3" onSubmit={(ev) => void onUpload(ev)}>
                    <input
                      name="file"
                      type="file"
                      accept="application/pdf"
                      required
                      className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-violet-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-900"
                    />
                    <button
                      type="submit"
                      disabled={upBusy}
                      className="w-full rounded-2xl bg-[#12B886] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95 disabled:opacity-60"
                    >
                      {upBusy ? "Subiendo…" : "⬆️ Guardar en el contrato"}
                    </button>
                  </form>
                </section>
              </div>
            )}

            {msg && <p className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-800">{msg}</p>}

            <p className="mt-6 text-[11px] text-slate-500">
              ArriendoSeguro no es notaría ni cobra por estos trámites. La firma la respalda la Agencia Nacional Digital (Decreto 620 de 2020).
            </p>
          </>
        )}
        <TenantPromoFooter variant="landlord" />
      </div>
    </div>
  );
}
