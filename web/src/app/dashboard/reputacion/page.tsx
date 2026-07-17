"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { StarRating } from "@/components/reputation/star-rating";
import { ReputationConsentSections } from "@/components/reputation/consent-sections";
import { CertificateShare } from "@/components/reputation/certificate-share";
import { DirectoryPanel } from "@/components/reputation/directory-panel";
import { REPUTATION_DIRECTION_LABELS, type ReputationDirection } from "@/domain/reputation/criteria";

type DirSummary = {
  direction: string;
  reviewsCount: number;
  overallAverage: number;
  perCriterion: { key: string; label: string; average: number }[];
};

export default function MiReputacionPage() {
  const { user, loading } = useAuth();
  const [summary, setSummary] = useState<DirSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/reputation/summary", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as {
        success?: boolean;
        summary?: DirSummary[];
        totalReviews?: number;
        errors?: { message?: string }[];
      };
      if (!res.ok || !json.success) {
        setError(json.errors?.[0]?.message ?? "No se pudo cargar tu reputación.");
        return;
      }
      setSummary(json.summary ?? []);
      setTotal(json.totalReviews ?? 0);
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Reputación</p>
        <h1 className="text-2xl font-bold">Mi reputación</h1>
        <p className="text-sm text-slate-600">
          Promedio de estrellas que has recibido en tus arriendos, por variable. Es privado: solo tú lo ves; nadie puede
          buscarte por cédula.
        </p>
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          El promedio pondera más tu <strong>comportamiento reciente</strong> que el histórico antiguo, para reflejar tu
          situación actual y premiar la mejora. Como titular de tus datos puedes conocer, actualizar y rectificar esta
          información (Ley 1581 de 2012).
        </p>
      </header>

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {error && <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {summary && total === 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Todavía no tienes calificaciones recibidas. Aparecerán cuando la otra parte te califique tras cerrar un
          arriendo.
        </p>
      )}

      {summary &&
        summary.map((s) => (
          <section key={s.direction} className="rounded-2xl border border-slate-300 bg-white/95 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Como {s.direction === "landlord_to_tenant" ? "arrendatario (inquilino)" : "arrendador (dueño)"}
              </h2>
              <span className="text-xs text-slate-500">
                {s.reviewsCount} calificación(es) ·{" "}
                <span title={REPUTATION_DIRECTION_LABELS[s.direction as ReputationDirection]}>
                  {s.overallAverage.toFixed(1)} / 5
                </span>
              </span>
            </div>
            <div className="mt-1">
              <StarRating name={`overall-${s.direction}`} value={Math.round(s.overallAverage)} readOnly />
            </div>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {s.perCriterion.map((c) => (
                <li key={c.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{c.label}</span>
                  <span className="flex items-center gap-2">
                    <StarRating name={`c-${s.direction}-${c.key}`} value={Math.round(c.average)} readOnly />
                    <span className="text-xs text-slate-500">{c.average.toFixed(1)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <DirectoryPanel />

      <CertificateShare />

      <ReputationConsentSections />

      <p className="text-xs text-slate-500">
        Ver la{" "}
        <Link href="/legal/evaluacion" className="text-violet-700 underline">
          política de evaluación
        </Link>
        .
      </p>
    </main>
  );
}
