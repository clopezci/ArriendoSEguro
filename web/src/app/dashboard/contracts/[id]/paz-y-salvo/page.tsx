"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { buildWhatsAppUrl } from "@/lib/nuevo/whatsapp";

type Ctx = {
  viewerRole: string;
  landlord: { name: string; doc: string; phone: string; city: string };
  tenant: { name: string; doc: string; phone: string; city: string };
  property: { address: string; city: string };
  lease: { canon: number; startDate: string; endDate: string };
  payment: { hasSchedule: boolean; sinDatos: boolean; alDia: boolean; pendientes: number; overdue: number; dueTotal: number };
};

function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function pazYSalvoText(c: Ctx, standard: boolean): string {
  const city = c.property.city || c.landlord.city || "____";
  const cumplimiento = standard
    ? "Durante la vigencia del contrato cumplió con el pago de los cánones de arrendamiento sin novedad."
    : "El arrendatario cumplió con el pago de los cánones de arrendamiento de manera oportuna, según el registro de la plataforma.";
  return [
    "PAZ Y SALVO",
    "",
    `${city}, ${todayLabel()}.`,
    "",
    `Yo, ${c.landlord.name || "____"}, identificado(a) con ${c.landlord.doc || "____"}, en calidad de ARRENDADOR del inmueble ubicado en ${c.property.address || "____"}, hago constar que el(la) señor(a) ${c.tenant.name || "____"}, identificado(a) con ${c.tenant.doc || "____"}, en calidad de ARRENDATARIO(A), se encuentra A PAZ Y SALVO por concepto de cánones de arrendamiento y demás obligaciones derivadas del contrato de arrendamiento, con corte a la fecha.`,
    "",
    cumplimiento,
    "",
    "El presente paz y salvo se expide a solicitud del interesado.",
    "",
    "_______________________________",
    c.landlord.name || "Arrendador",
    `C.C. ${c.landlord.doc || "____"}`,
    "Arrendador",
  ].join("\n");
}

function recomendacionText(c: Ctx): string {
  const city = c.property.city || c.landlord.city || "____";
  const first = (c.tenant.name || "El arrendatario").split(" ")[0];
  const periodo = c.lease.startDate && c.lease.endDate ? ` durante el período comprendido entre ${c.lease.startDate} y ${c.lease.endDate}` : "";
  return [
    "CARTA DE RECOMENDACIÓN",
    "",
    `${city}, ${todayLabel()}.`,
    "",
    "A quien corresponda:",
    "",
    `Por medio de la presente, yo ${c.landlord.name || "____"}, identificado(a) con ${c.landlord.doc || "____"}, en calidad de arrendador del inmueble ubicado en ${c.property.address || "____"}, me permito recomendar al(la) señor(a) ${c.tenant.name || "____"}, identificado(a) con ${c.tenant.doc || "____"}, quien fue arrendatario(a) de dicho inmueble${periodo}.`,
    "",
    `Durante su estadía, ${first} demostró ser una persona responsable, cumplida con sus pagos y respetuosa con el inmueble y las normas de convivencia. Por lo anterior, lo(a) recomiendo como arrendatario(a).`,
    "",
    "Quedo atento(a) a cualquier información adicional.",
    "",
    "Cordialmente,",
    "",
    "_______________________________",
    c.landlord.name || "Arrendador",
    `C.C. ${c.landlord.doc || "____"}`,
    c.landlord.phone ? `Tel: ${c.landlord.phone}` : "",
  ].filter((l) => l !== undefined).join("\n");
}

export default function PazYSalvoPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [pazText, setPazText] = useState("");
  const [recText, setRecText] = useState("");
  const [pazUnlocked, setPazUnlocked] = useState(false); // se generó (o se confirmó estándar)
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/contracts/paz-y-salvo/context?contractId=${encodeURIComponent(id)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] } & Partial<Ctx>;
      if (!res.ok || !j.success) {
        setErr(j.errors?.[0]?.message ?? "No se pudo cargar el contexto del contrato.");
        return;
      }
      setCtx(j as Ctx);
      setRecText(recomendacionText(j as Ctx));
    } catch {
      setErr("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { void load(); }, [load]);

  const pay = ctx?.payment;
  const canPazDirect = Boolean(pay?.alDia);
  const pazBlocked = Boolean(pay && !pay.sinDatos && !pay.alDia); // hay pendientes reales

  function generarPaz() {
    if (!ctx) return;
    if (pazBlocked) {
      setMsg(`No se puede emitir paz y salvo: el inquilino tiene ${pay?.pendientes} pago(s) pendiente(s) en la plataforma. Debe estar totalmente al día.`);
      return;
    }
    let standard = false;
    if (pay?.sinDatos) {
      const ok = window.confirm("En la plataforma no hay pruebas de pago de este contrato. ¿Seguro que quieres generar el paz y salvo?\n\nSe generará un paz y salvo ESTÁNDAR (asume que el inquilino siempre pagó sin problema). Podrás modificarlo antes de enviarlo.");
      if (!ok) return;
      standard = true;
    }
    setPazText(pazYSalvoText(ctx, standard));
    setPazUnlocked(true);
    setMsg("");
  }

  const paymentBanner = useMemo(() => {
    if (!pay) return null;
    if (pay.alDia) return { cls: "border-emerald-300 bg-emerald-50 text-emerald-900", text: `✓ El inquilino está al día (${pay.dueTotal} pago(s) verificados en la plataforma).` };
    if (pay.sinDatos) return { cls: "border-amber-300 bg-amber-50 text-amber-900", text: "No hay calendario ni pruebas de pago en la plataforma. Podrás generar un paz y salvo estándar (bajo tu responsabilidad)." };
    return { cls: "border-rose-300 bg-rose-50 text-rose-900", text: `Hay ${pay.pendientes} pago(s) pendiente(s) (${pay.overdue} vencido(s)). No se puede emitir paz y salvo hasta estar al día.` };
  }, [pay]);

  function shareWhats(text: string, label: string) {
    if (!ctx) return;
    const intro = `Hola${ctx.tenant.name ? ` ${ctx.tenant.name.split(" ")[0]}` : ""}, te comparto tu ${label} del arriendo${ctx.property.address ? ` de ${ctx.property.address}` : ""}:\n\n`;
    window.open(buildWhatsAppUrl(ctx.tenant.phone, intro + text), "_blank", "noopener,noreferrer");
  }
  function shareBoth() {
    if (!ctx || !pazUnlocked) return;
    const combined = `${pazText}\n\n———\n\n${recText}`;
    shareWhats(combined, "paz y salvo y carta de recomendación");
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMsg("Copiado ✓"); } catch { setMsg(""); }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <ExpedientePostWizardNav contractId={id} />

      <header className="space-y-2">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[#17151F]">Paz y salvo y recomendación</h1>
        <p className="mt-2 text-slate-500">
          Al terminar el arriendo, genera el <b>paz y salvo</b> (según el comportamiento de pago) y la <b>carta de
          recomendación</b>. Son formatos prehechos que puedes <b>editar</b> y enviar al inquilino por WhatsApp.
        </p>
      </header>

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {err && <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}

      {!loading && ctx && (
        <>
          {paymentBanner && <div className={`rounded-2xl border p-3 text-sm ${paymentBanner.cls}`}>{paymentBanner.text}</div>}

          {/* Enlace al acta de entrega y devolución (mismo cierre del arriendo). */}
          <Link href={`/nuevo/gestionar/${id}/inventario?kind=final`} className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white/90 p-4 transition hover:border-[#5646E5]">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#ECE9FB] text-lg">📦</span>
            <span className="min-w-0 flex-1">
              <b className="text-sm">Acta de entrega y devolución</b>
              <span className="mt-0.5 block text-[12px] text-slate-500">Registra con fotos el estado del inmueble al devolverlo (mismo proceso del inventario). Queda aparte para comparar.</span>
            </span>
            <span className="text-sm font-bold text-[#5646E5]">→</span>
          </Link>

          {/* PAZ Y SALVO */}
          <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">Paz y salvo</h2>
              {!pazUnlocked ? (
                <button type="button" onClick={generarPaz} disabled={pazBlocked} className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50">
                  {canPazDirect ? "Generar paz y salvo" : pazBlocked ? "Bloqueado (pagos pendientes)" : "Generar (estándar)"}
                </button>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ Generado</span>
              )}
            </div>
            {pazUnlocked && (
              <>
                <textarea value={pazText} onChange={(e) => setPazText(e.target.value)} rows={14} className="mt-3 w-full rounded-2xl border-2 border-slate-200 p-3 font-mono text-xs outline-none focus:border-[#5646E5]" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => shareWhats(pazText, "paz y salvo")} className="rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white">🟢 Enviar por WhatsApp</button>
                  <button type="button" onClick={() => void copy(pazText)} className="rounded-xl border-2 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Copiar</button>
                </div>
              </>
            )}
          </section>

          {/* RECOMENDACIÓN */}
          <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Carta de recomendación</h2>
            <p className="mt-0.5 text-xs text-slate-500">Independiente del paz y salvo. Edítala a tu gusto antes de enviarla.</p>
            <textarea value={recText} onChange={(e) => setRecText(e.target.value)} rows={14} className="mt-3 w-full rounded-2xl border-2 border-slate-200 p-3 font-mono text-xs outline-none focus:border-[#5646E5]" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => shareWhats(recText, "carta de recomendación")} className="rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white">🟢 Enviar por WhatsApp</button>
              <button type="button" onClick={() => void copy(recText)} className="rounded-xl border-2 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Copiar</button>
            </div>
          </section>

          {pazUnlocked && (
            <button type="button" onClick={shareBoth} className="w-full rounded-2xl bg-[#12B886] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95">
              🟢 Enviar LOS DOS por WhatsApp al inquilino
            </button>
          )}

          {msg && <p className="text-sm font-medium text-emerald-700">{msg}</p>}

          <p className="text-[11px] leading-relaxed text-slate-500">
            Estos documentos los firma y expide el <b>arrendador</b> bajo su responsabilidad. ArriendoSeguro genera un
            formato editable a partir de los datos del contrato; no certifica ni sustituye asesoría legal.
          </p>
        </>
      )}
    </main>
  );
}
