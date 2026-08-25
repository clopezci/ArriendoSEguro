"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { BentoShell } from "@/components/layout/bento-shell";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { FileButton } from "@/components/ui/file-button";
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_CATEGORY_LABELS,
  REQUEST_TYPES,
  requestTypeDef,
  roleBucket,
  RESPONSE_ACTION_LABELS,
  type MaintenanceCategory,
  type RequestType,
} from "@/domain/maintenance/maintenance";
import { ContactModal, type Partner } from "@/components/partners/partners-directory";

type ResponseItem = { action: string; reason: string | null; at: string; byRole?: string };
type Req = {
  id: string;
  type: string;
  title: string;
  description: string;
  category: string;
  status: string;
  rejectionCount: number;
  reportedByRole: string;
  reportedByEmail: string;
  reportedByUid: string;
  hasPhoto: boolean;
  responses: ResponseItem[];
  createdAt: string;
  resolvedAt: string | null;
};
type Template = { title: string; description: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Abierta (esperando respuesta)", cls: "border-sky-300 bg-sky-50 text-sky-800" },
  in_review: { label: "En revisión", cls: "border-indigo-300 bg-indigo-50 text-indigo-800" },
  accepted: { label: "Aceptada / se atenderá", cls: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  rejected: { label: "No procede", cls: "border-rose-300 bg-rose-50 text-rose-800" },
  in_dispute: { label: "En disputa", cls: "border-amber-400 bg-amber-50 text-amber-900" },
  resolved: { label: "Resuelta", cls: "border-slate-300 bg-slate-100 text-slate-700" },
  cancelled: { label: "Cancelada", cls: "border-slate-300 bg-slate-100 text-slate-500" },
};

export default function MantenimientoPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [myRole, setMyRole] = useState("");
  const [requests, setRequests] = useState<Req[]>([]);
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Formulario de nueva solicitud/reporte.
  const [type, setType] = useState<RequestType>("damage");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory>("plumbing");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  // Respuesta "no procede" (motivo inline) y aliado jurídico.
  const [rejectingId, setRejectingId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [juridica, setJuridica] = useState<Partner | null>(null);
  const [lawyerFor, setLawyerFor] = useState<Req | null>(null);

  const bucket = roleBucket(myRole);
  // Tipos que este rol puede crear.
  const myTypes = useMemo(() => REQUEST_TYPES.filter((t) => t.role === bucket), [bucket]);
  const currentDef = requestTypeDef(type);

  // Al elegir un tipo con plantilla (cobro/entrega), pre-carga el texto (editable).
  function pickType(next: RequestType) {
    setType(next);
    const def = requestTypeDef(next);
    if (def && def.template !== "none" && templates[def.template]) {
      setTitle(templates[def.template].title);
      setDescription(templates[def.template].description);
    } else {
      setTitle("");
      setDescription("");
    }
    setFormMsg("");
  }

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/contracts/maintenance/list?contractId=${encodeURIComponent(id)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as {
        success?: boolean; myRole?: string; requests?: Req[]; templates?: Record<string, Template>; errors?: { message?: string }[];
      };
      if (!res.ok || !j.success) {
        setError(j.errors?.[0]?.message ?? "No se pudieron cargar las solicitudes.");
        return;
      }
      setMyRole(j.myRole ?? "");
      setRequests(j.requests ?? []);
      setTemplates(j.templates ?? {});
      // Ajusta el tipo por defecto al rol (inquilino: daño; dueño: reparación).
      setType((prev) => {
        const stillValid = REQUEST_TYPES.some((t) => t.type === prev && t.role === roleBucket(j.myRole ?? ""));
        if (stillValid) return prev;
        return roleBucket(j.myRole ?? "") === "landlord" ? "repair" : "damage";
      });
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partners/active", { cache: "no-store" });
        const j = (await res.json()) as { success?: boolean; partners?: Partner[] };
        const p = (j.partners ?? []).find((x) => x.category === "juridica") ?? null;
        if (!cancelled) setJuridica(p);
      } catch {
        /* sin aliado */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createRequest() {
    if (!user) return;
    if (!title.trim() || description.trim().length < 5) {
      setFormMsg("Escribe el título y una descripción de la solicitud.");
      return;
    }
    setBusy(true);
    setFormMsg("");
    try {
      const fd = new FormData();
      fd.set("contractId", id);
      fd.set("type", type);
      fd.set("title", title);
      if (currentDef?.useCategory) fd.set("category", category);
      fd.set("description", description);
      if (file) fd.set("file", file);
      const res = await fetch("/api/contracts/maintenance/create", {
        method: "POST",
        headers: { ...(await buildAuthHeaders(user)) },
        body: fd,
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setFormMsg(j.errors?.[0]?.message ?? "No se pudo registrar la solicitud.");
        return;
      }
      setTitle("");
      setDescription("");
      setCategory("plumbing");
      setFile(null);
      setFormMsg("Solicitud registrada. Avisamos a la otra parte.");
      await load();
    } catch {
      setFormMsg("Error de red al registrar.");
    } finally {
      setBusy(false);
    }
  }

  async function respond(reqId: string, action: "will_review" | "accept" | "reject", reason?: string) {
    if (!user) return;
    try {
      const res = await fetch("/api/contracts/maintenance/respond", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, requestId: reqId, action, reason }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setError(j.errors?.[0]?.message ?? "No se pudo registrar la respuesta.");
        return;
      }
      setRejectingId("");
      setRejectReason("");
      await load();
    } catch {
      setError("Error de red.");
    }
  }

  async function update(reqId: string, action: "reopen" | "resolve" | "cancel") {
    if (!user) return;
    try {
      const res = await fetch("/api/contracts/maintenance/update", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, requestId: reqId, action }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setError(j.errors?.[0]?.message ?? "No se pudo actualizar.");
        return;
      }
      await load();
    } catch {
      setError("Error de red.");
    }
  }

  async function viewPhoto(reqId: string) {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/contracts/maintenance/photo?contractId=${encodeURIComponent(id)}&requestId=${encodeURIComponent(reqId)}`,
        { headers: { ...(await buildAuthHeaders(user)) } },
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* no-op */
    }
  }

  return (
    <BentoShell>
      <WizardShell title="Solicitudes y reportes" currentStep={13} contractId={id} variant="extra" phase="posventa" lean>
        <p className="mb-4 text-sm text-slate-700">
          Según tu rol en este contrato, puedes crear reportes o solicitudes. La otra parte recibe la notificación y
          responde (<strong>lo revisaré</strong>, <strong>de acuerdo / lo atenderé</strong> o <strong>no procede</strong>).
          Todo queda registrado para trazabilidad. ArriendoSeguro no ejecuta las reparaciones; da comunicación y respaldo.
        </p>

        <RequiresSavedContract id={id}>
          {!user && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Inicia sesión con el correo de una parte del contrato para ver y registrar solicitudes.
            </p>
          )}
          {error && <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

          {user && myRole && (
            <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                {bucket === "landlord" ? "Crear solicitud (como dueño)" : "Reportar / solicitar (como inquilino)"}
              </h2>
              <div className="mt-3 space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Tipo</span>
                  <select
                    value={type}
                    onChange={(e) => pickType(e.target.value as RequestType)}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#5646E5]"
                  >
                    {myTypes.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.icon} {t.label}
                      </option>
                    ))}
                  </select>
                  {currentDef?.hint && <span className="mt-1 block text-[11px] text-slate-500">{currentDef.hint}</span>}
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Asunto</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    placeholder="Título corto"
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#5646E5]"
                  />
                </label>

                {currentDef?.useCategory && (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">Categoría</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#5646E5]"
                    >
                      {MAINTENANCE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {MAINTENANCE_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Descripción
                    {currentDef && currentDef.template !== "none" && (
                      <span className="ml-1 text-[11px] font-normal text-violet-700">(texto sugerido; puedes editarlo)</span>
                    )}
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={currentDef && currentDef.template !== "none" ? 6 : 3}
                    maxLength={1500}
                    placeholder="Detalla la solicitud."
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#5646E5]"
                  />
                </label>

                <div className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Foto / soporte (opcional, JPG/PNG)</span>
                  <FileButton file={file} onFile={setFile} accept="image/jpeg,image/png" label="Elegir foto o soporte" />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createRequest()}
                  className="rounded-2xl bg-[#5646E5] px-5 py-2.5 text-sm font-bold text-white hover:brightness-105 disabled:opacity-60"
                >
                  {busy ? "Enviando…" : "Registrar y notificar"}
                </button>
                {formMsg && <p className="text-sm text-slate-700">{formMsg}</p>}
              </div>
            </section>
          )}

          {/* Listado */}
          <section className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Historial</h2>
            {loading && <p className="text-sm text-slate-600">Cargando…</p>}
            {!loading && requests.length === 0 && (
              <p className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
                Aún no hay solicitudes ni reportes.
              </p>
            )}
            {requests.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.open;
              const dispute = r.status === "in_dispute";
              const active = r.status !== "resolved" && r.status !== "cancelled";
              const def = requestTypeDef(r.type);
              const iAmCreator = r.reportedByUid === (user?.uid ?? "") || r.reportedByEmail === (user?.email ?? "");
              // La contraparte (no quien la creó) responde, mientras esté abierta o en revisión.
              const canRespond = myRole && roleBucket(myRole) !== roleBucket(r.reportedByRole) && (r.status === "open" || r.status === "in_review");
              return (
                <article key={r.id} className="rounded-3xl border-2 border-slate-200 bg-white/90 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-[#17151F]">
                        {def ? `${def.icon} ` : ""}{r.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {def ? def.label : "Solicitud"}
                        {def?.useCategory ? ` · ${MAINTENANCE_CATEGORY_LABELS[r.category as MaintenanceCategory] ?? r.category}` : ""}
                        {" · "}
                        {roleBucket(r.reportedByRole) === "landlord" ? "creada por el dueño" : "creada por el inquilino"}
                        {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString("es-CO")}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
                  </div>
                  {r.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{r.description}</p>}
                  {r.hasPhoto && (
                    <button type="button" onClick={() => void viewPhoto(r.id)} className="mt-2 text-xs font-semibold text-violet-700 underline">
                      Ver foto / soporte
                    </button>
                  )}
                  {r.responses.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                      {r.responses.map((resp, i) => (
                        <li key={i}>
                          {resp.action === "will_review" ? "👀" : resp.action === "accept" ? "✅" : "✋"}{" "}
                          {RESPONSE_ACTION_LABELS[resp.action as keyof typeof RESPONSE_ACTION_LABELS] ?? resp.action}
                          {resp.reason ? ` — ${resp.reason}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}

                  {dispute && (
                    <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-3">
                      <p className="text-sm font-semibold text-amber-900">¿No llegan a un acuerdo?</p>
                      <p className="mt-1 text-xs text-amber-900/90">
                        Pueden consultar con un abogado experto en vivienda para resolver esta disputa.
                      </p>
                      {juridica ? (
                        <button
                          type="button"
                          onClick={() => setLawyerFor(r)}
                          className="mt-2 rounded-2xl bg-[#FF6B4A] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:brightness-105"
                        >
                          Hablar con un abogado
                        </button>
                      ) : (
                        <p className="mt-2 text-[11px] text-amber-800/80">
                          Pronto habilitaremos un aliado jurídico para conectarte con un abogado.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canRespond && (
                      <>
                        <button
                          type="button"
                          onClick={() => void respond(r.id, "will_review")}
                          className="rounded-2xl border-2 border-indigo-300 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50"
                        >
                          👀 Lo revisaré
                        </button>
                        <button
                          type="button"
                          onClick={() => void respond(r.id, "accept")}
                          className="rounded-2xl bg-[#12B886] px-4 py-2 text-sm font-bold text-white hover:brightness-105"
                        >
                          ✅ De acuerdo / lo atenderé
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectingId(r.id); setRejectReason(""); }}
                          className="rounded-2xl border-2 border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
                        >
                          ✋ No procede
                        </button>
                      </>
                    )}
                    {iAmCreator && r.status === "rejected" && (
                      <button
                        type="button"
                        onClick={() => void update(r.id, "reopen")}
                        className="rounded-2xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Insistir (reabrir)
                      </button>
                    )}
                    {active && (
                      <button
                        type="button"
                        onClick={() => void update(r.id, "resolve")}
                        className="rounded-2xl border-2 border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Marcar como resuelta
                      </button>
                    )}
                    {active && iAmCreator && (
                      <button
                        type="button"
                        onClick={() => void update(r.id, "cancel")}
                        className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  {/* Motivo de "no procede" inline */}
                  {rejectingId === r.id && (
                    <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50/60 p-3">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        maxLength={1000}
                        placeholder="¿Por qué no procede? (obligatorio)"
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={!rejectReason.trim()}
                          onClick={() => void respond(r.id, "reject", rejectReason.trim())}
                          className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button type="button" onClick={() => setRejectingId("")} className="rounded-2xl px-3 py-2 text-sm text-slate-500">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </RequiresSavedContract>
      </WizardShell>

      {lawyerFor && juridica && (
        <ContactModal
          partner={juridica}
          userEmail={user?.email ?? ""}
          defaultMessage={`Tengo una disputa por una solicitud ("${lawyerFor.title}") en mi arriendo y necesito asesoría jurídica.`}
          onClose={() => setLawyerFor(null)}
        />
      )}
    </BentoShell>
  );
}
