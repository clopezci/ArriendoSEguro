"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useSavedContract } from "@/components/contracts/requires-saved-contract";
import { JourneyProgress } from "@/components/contracts/journey-progress";

/**
 * Posventa del contrato como **checklist guiado**: un único centro de control
 * con los pasos de la posventa en orden recomendado y su estado (✓ Hecho /
 * Pendiente), para que el usuario sepa por dónde empezar y qué le falta. Las
 * sub-páginas vuelven aquí (no hay navegación libre que confunda).
 */
type ItemKey = "documentos" | "pago" | "calendario" | "inventario" | "acta" | "notaria";
type ItemStatus = "loading" | "done" | "pending";

type ChecklistItem = {
  key: ItemKey;
  slug: string;
  title: string;
  description: string;
  optional?: boolean;
};

const CHECKLIST: ChecklistItem[] = [
  {
    key: "documentos",
    slug: "documentos-propiedad",
    title: "Documentos de propiedad / poder",
    description: "Sube la escritura, el certificado de libertad o el poder autenticado (si eres apoderado).",
  },
  {
    key: "pago",
    slug: "pagos-recordatorios",
    title: "Pagos y recordatorios",
    description: "Elige tu método (cuenta/QR) y los días de aviso. El calendario se arma solo.",
  },
  {
    key: "calendario",
    slug: "payment-schedule",
    title: "Ver calendario de pagos",
    description: "Se genera automáticamente al configurar tus pagos. Aquí puedes verlo.",
    optional: true,
  },
  {
    key: "inventario",
    slug: "inventory",
    title: "Inventario inicial del inmueble",
    description: "Registra el estado del inmueble por zonas (fotos), base para la entrega.",
  },
  {
    key: "acta",
    slug: "inventory",
    title: "Acta de entrega",
    description: "Genera el acta de entrega del inmueble (requiere el inventario).",
  },
  {
    key: "notaria",
    slug: "notarial",
    title: "Autenticación notarial",
    description: "Opcional: sube el PDF autenticado en notaría como refuerzo a la firma.",
    optional: true,
  },
];

const SECONDARY = [
  { slug: "payments", title: "Registro de pagos", description: "Confirma pagos, genera anexos y el enlace para el inquilino." },
  { slug: "novedades", title: "Novedades del arriendo", description: "Incumplimientos, reparaciones, convivencia y acuerdos." },
  { slug: "alertas", title: "Alertas de vencimiento", description: "Recordatorios de terminación o renovación del contrato." },
  { slug: "reputacion", title: "Calificar la experiencia", description: "Califica al inquilino al final del arriendo." },
  { slug: "evidencia", title: "Paquete de evidencia (ZIP)", description: "Descarga unificada del expediente cuando esté disponible." },
];

export default function PosventaHubPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const sc = useSavedContract(id);
  const saved = sc.status === "saved";
  const unlocked = saved || sc.status === "error";
  const versionId = sc.currentVersionId ?? "";

  const [status, setStatus] = useState<Record<ItemKey, ItemStatus>>({
    documentos: "loading",
    pago: "loading",
    calendario: "loading",
    inventario: "loading",
    acta: "loading",
    notaria: "loading",
  });

  useEffect(() => {
    if (!saved || !versionId) return;
    let cancelled = false;
    const vq = `contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`;
    const done = (k: ItemKey, ok: boolean) =>
      !cancelled && setStatus((s) => ({ ...s, [k]: ok ? "done" : "pending" }));

    void (async () => {
      const authH = user ? await buildAuthHeaders(user) : {};
      // Documentos de propiedad (auth)
      fetch(`/api/contracts/property-documents/list?${vq}`, { headers: { ...authH } })
        .then((r) => r.json())
        .then((j) => done("documentos", Array.isArray(j?.documents) && j.documents.length > 0))
        .catch(() => done("documentos", false));
      // Método de pago (auth)
      fetch(`/api/contracts/payment-settings?contractId=${encodeURIComponent(id)}`, { headers: { ...authH } })
        .then((r) => r.json())
        .then((j) => done("pago", Boolean(j?.settings && j.settings.method && j.settings.method !== "none")))
        .catch(() => done("pago", false));
      // Calendario de pagos
      fetch(`/api/payments/schedule/list?${vq}`)
        .then((r) => r.json())
        .then((j) => done("calendario", Array.isArray(j?.scheduledPayments) && j.scheduledPayments.length > 0))
        .catch(() => done("calendario", false));
      // Inventario
      fetch(`/api/inventory/by-contract?${vq}`)
        .then((r) => r.json())
        .then((j) => done("inventario", j?.inventory?.status === "completed" || j?.inventory?.status === "signed"))
        .catch(() => done("inventario", false));
      // Anexos (acta de entrega + notaría)
      fetch(`/api/contracts/annexes/list?${vq}`)
        .then((r) => r.json())
        .then((j) => {
          const annexes: Array<{ annexType?: string; status?: string; pdfUrl?: string | null }> = Array.isArray(j?.annexes) ? j.annexes : [];
          done("acta", annexes.some((a) => a.annexType === "initial_delivery_act" && a.status === "generated"));
          done("notaria", annexes.some((a) => a.annexType === "notarial_authentication" && Boolean(a.pdfUrl)));
        })
        .catch(() => {
          done("acta", false);
          done("notaria", false);
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [saved, versionId, id, user]);

  const requiredItems = CHECKLIST.filter((i) => !i.optional);
  const doneCount = requiredItems.filter((i) => status[i.key] === "done").length;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Posventa · paso a paso</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Posventa del contrato</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Este es tu centro de control. Haz los pasos en orden; cada uno te indica si ya está <strong>hecho</strong> o{" "}
          <strong>pendiente</strong>. Puedes saltarte los marcados como opcionales.
        </p>
        <div className="pt-1">
          <JourneyProgress id={id} activePhase="posventa" />
        </div>
      </header>

      {!saved && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          La posventa se habilita cuando <strong>guardes tu contrato</strong> en la vista previa.{" "}
          <Link href={`/dashboard/contracts/${id}/preview`} className="font-semibold underline">
            Termina y guarda tu contrato →
          </Link>
        </div>
      )}

      {unlocked && (
        <>
          <p className="text-xs font-medium text-slate-600">
            Progreso: {doneCount} de {requiredItems.length} pasos principales completados.
          </p>
          <ol className="space-y-3">
            {CHECKLIST.map((item, idx) => {
              const st = status[item.key];
              const isDone = st === "done";
              return (
                <li key={item.key}>
                  <Link
                    href={`/dashboard/contracts/${id}/${item.slug}`}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_6px_20px_rgba(139,92,246,0.1)] transition hover:border-violet-400"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isDone ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
                      }`}
                    >
                      {isDone ? "✓" : idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{item.title}</span>
                        {item.optional && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Opcional</span>
                        )}
                        {st === "loading" ? (
                          <span className="text-[10px] text-slate-400">…</span>
                        ) : isDone ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">✓ Hecho</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{item.description}</span>
                    </span>
                    <span className="shrink-0 self-center text-xs font-semibold text-violet-700">{isDone ? "Ajustar →" : "Hacer →"}</span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <section className="space-y-2 pt-2">
            <h2 className="text-sm font-bold text-slate-900">Durante el arriendo</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {SECONDARY.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/dashboard/contracts/${id}/${item.slug}`}
                    className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-3 transition hover:border-violet-400"
                  >
                    <span className="text-sm font-semibold text-violet-900">{item.title}</span>
                    <span className="mt-1 text-xs text-slate-600">{item.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div>
        <Link href={`/dashboard/contracts/${id}/preview`} className="text-sm text-violet-700 underline hover:text-violet-900">
          ← Volver a la vista previa
        </Link>
      </div>
    </main>
  );
}
