"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { StarRating } from "@/components/reputation/star-rating";
import {
  REPLICA_REASONS,
  REPLICA_TEXT_MAX,
  REPUTATION_DIRECTION_LABELS,
  type ReputationCriterion,
  type ReputationDirection,
} from "@/domain/reputation/criteria";

type ReplyView = { reason: string; text: string; byRole: string; createdAt: string } | null;

type ReviewView = {
  direction: string;
  ratings: Record<string, number>;
  overall: number;
  raterRole: string;
  updatedAt: string;
  reply: ReplyView;
} | null;

type ForContract = {
  success: boolean;
  canRate: boolean;
  reason: string | null;
  contractStatus?: string;
  myDirection: ReputationDirection | null;
  criteria: ReputationCriterion[];
  myReview: ReviewView;
  counterpartReview: ReviewView;
  counterpartPending?: boolean;
};

export function ReputationPanel({ contractId }: { contractId: string }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<ForContract | null>(null);
  const [error, setError] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [replyReason, setReplyReason] = useState<(typeof REPLICA_REASONS)[number] | "">("");
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyMsg, setReplyMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reputation/for-contract?contractId=${encodeURIComponent(contractId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const json = (await res.json()) as ForContract & { errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setError(json.errors?.[0]?.message ?? "No se pudo cargar la calificación.");
        setInfo(null);
        return;
      }
      setInfo(json);
      if (json.myReview?.ratings) setRatings(json.myReview.ratings);
      if (json.counterpartReview?.reply) {
        const reasons = REPLICA_REASONS as readonly string[];
        setReplyReason(
          reasons.includes(json.counterpartReview.reply.reason)
            ? (json.counterpartReview.reply.reason as (typeof REPLICA_REASONS)[number])
            : "",
        );
        setReplyText(json.counterpartReview.reply.text ?? "");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [contractId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!user || !info?.myDirection) return;
    const keys = info.criteria.map((c) => c.key);
    if (keys.some((k) => !ratings[k])) {
      setMsg("Asigna estrellas a todas las variables antes de enviar.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/reputation/submit", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, direction: info.myDirection, ratings }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setMsg(json.errors?.[0]?.message ?? "No se pudo guardar la calificación.");
        return;
      }
      setMsg("¡Gracias! Tu calificación se guardó.");
      await load();
    } catch {
      setMsg("Error de red al guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReply() {
    if (!user || !replyReason) {
      setReplyMsg("Elige un motivo para tu réplica.");
      return;
    }
    setReplyBusy(true);
    setReplyMsg("");
    try {
      const res = await fetch("/api/reputation/reply", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, reason: replyReason, text: replyText.trim() || undefined }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setReplyMsg(json.errors?.[0]?.message ?? "No se pudo guardar la réplica.");
        return;
      }
      setReplyMsg("Réplica guardada. Quedará junto a la calificación.");
      await load();
    } catch {
      setReplyMsg("Error de red al guardar la réplica.");
    } finally {
      setReplyBusy(false);
    }
  }

  if (!user) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Inicia sesión con el correo de una parte del contrato para calificar.
      </p>
    );
  }
  if (loading) return <p className="text-sm text-slate-600">Cargando calificación…</p>;
  if (error) {
    return <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>;
  }
  if (!info) return null;

  if (!info.myDirection) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Tu rol en este contrato no emite calificaciones de reputación en esta fase.
      </p>
    );
  }

  const alreadyRated = Boolean(info.myReview);

  return (
    <div className="space-y-5">
      {/* Selector de dirección (según tu rol en el contrato) */}
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
        <label htmlFor="rep-direction" className="text-xs font-medium uppercase tracking-wide text-violet-700">
          Calificas como
        </label>
        <select
          id="rep-direction"
          className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          value={info.myDirection}
          disabled
        >
          <option value={info.myDirection}>{REPUTATION_DIRECTION_LABELS[info.myDirection]}</option>
        </select>
        <p className="mt-1 text-[11px] text-slate-600">
          La dirección se define por tu rol en el contrato. Las variables se valoran solo con estrellas (1 a 5), sin
          comentarios de texto.
        </p>
      </div>

      {!info.canRate && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          La calificación estará disponible cuando el contrato esté firmado o cerrado
          {info.contractStatus ? ` (estado actual: ${info.contractStatus}).` : "."}
        </p>
      )}

      {/* Formulario de estrellas por variable */}
      <fieldset className="space-y-3" disabled={!info.canRate || busy}>
        {info.criteria.map((c) => (
          <div
            key={c.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{c.label}</p>
              <p className="text-xs text-slate-600">{c.help}</p>
            </div>
            <StarRating
              name={c.key}
              value={ratings[c.key] ?? 0}
              onChange={(v) => setRatings((prev) => ({ ...prev, [c.key]: v }))}
            />
          </div>
        ))}
      </fieldset>

      {info.canRate && (
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="min-h-11 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
        >
          {busy ? "Guardando…" : alreadyRated ? "Actualizar calificación" : "Enviar calificación"}
        </button>
      )}

      {msg && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800" role="status">
          {msg}
        </p>
      )}

      {/* Calificación recibida (siempre visible para su titular, para poder replicar) */}
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold text-slate-900">Calificación que recibiste</h3>
        {info.counterpartReview ? (
          <div className="mt-2">
            <p className="text-sm text-slate-800">
              Promedio: <StarRating name="recibida" value={Math.round(info.counterpartReview.overall)} readOnly />{" "}
              <span className="text-xs text-slate-500">({info.counterpartReview.overall.toFixed(1)} / 5)</span>
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {Object.entries(info.counterpartReview.ratings).map(([k, v]) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="min-w-40 capitalize">{k}</span>
                  <StarRating name={`r-${k}`} value={v} readOnly />
                </li>
              ))}
            </ul>

            {/* Derecho de réplica del titular de la calificación */}
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
              <h4 className="text-xs font-semibold text-slate-900">Tu réplica (derecho de respuesta)</h4>
              <p className="mt-1 text-[11px] text-slate-600">
                Si no estás de acuerdo, puedes dejar una réplica. Quedará registrada junto a la calificación. No
                incluyas datos sensibles.
              </p>
              <select
                className="mt-2 block w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
                value={replyReason}
                onChange={(e) => setReplyReason(e.target.value as typeof replyReason)}
                disabled={replyBusy}
              >
                <option value="" disabled>
                  Motivo de la réplica
                </option>
                {REPLICA_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <textarea
                className="input mt-2 min-h-20"
                placeholder="Respuesta breve (opcional)"
                value={replyText}
                maxLength={REPLICA_TEXT_MAX}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={replyBusy}
              />
              <button
                type="button"
                onClick={() => void submitReply()}
                disabled={replyBusy || !replyReason}
                className="mt-2 rounded-lg border border-violet-500 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              >
                {replyBusy ? "Guardando…" : info.counterpartReview.reply ? "Actualizar réplica" : "Enviar réplica"}
              </button>
              {info.counterpartReview.reply && (
                <p className="mt-2 text-[11px] text-emerald-700">
                  Réplica registrada ({info.counterpartReview.reply.reason}).
                </p>
              )}
              {replyMsg && <p className="mt-1 text-[11px] text-slate-700">{replyMsg}</p>}
            </div>
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-600">La otra parte aún no te ha calificado.</p>
        )}
      </section>

      {/* Respuesta (réplica) de la otra parte a la calificación que tú enviaste */}
      {alreadyRated && info.myReview?.reply && (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-900">Réplica de la otra parte a tu calificación</h3>
          <p className="mt-1 text-xs text-slate-700">
            Motivo: <strong>{info.myReview.reply.reason}</strong>
          </p>
          {info.myReview.reply.text && (
            <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{info.myReview.reply.text}</p>
          )}
        </section>
      )}

      <p className="text-xs text-slate-500">
        Las calificaciones son privadas y estructuradas, conforme a la{" "}
        <Link href="/legal/evaluacion" className="text-violet-700 underline">
          política de evaluación
        </Link>
        . No hay listas negras ni búsqueda por cédula.
      </p>
    </div>
  );
}
