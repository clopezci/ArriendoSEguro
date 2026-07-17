"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { StarRating } from "@/components/reputation/star-rating";

type Dir = {
  direction: string;
  reviewsCount: number;
  overallAverage: number;
  perCriterion: { key: string; label: string; average: number }[];
};
type ViewResp = {
  success?: boolean;
  valid?: boolean;
  reason?: string;
  subjectEmail?: string;
  aggregate?: { totalReviews: number; overallAverage: number; byDirection: Dir[] };
};

const REASON_LABEL: Record<string, string> = {
  not_found: "El certificado no existe.",
  revoked: "El titular revocó este certificado.",
  expired: "El certificado caducó. Pídele al titular uno nuevo.",
};

export default function CertificadoPage() {
  const token = String(useParams<{ token: string }>().token);
  const { user, loading } = useAuth();
  const [data, setData] = useState<ViewResp | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setError("");
    try {
      const res = await fetch(`/api/reputation/certificate/view?token=${encodeURIComponent(token)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as ViewResp & { errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setError(j.errors?.[0]?.message ?? "No se pudo abrir el certificado.");
        return;
      }
      setData(j);
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }, [token, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Certificado de reputación</p>
        <h1 className="text-2xl font-bold">Reputación en ArriendoSeguro</h1>
      </header>

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}

      {!loading && !user && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Este certificado es privado.</p>
          <p className="mt-1">
            Solo pueden verlo usuarios de ArriendoSeguro con sesión iniciada.{" "}
            <Link href="/ingresar" className="font-semibold text-violet-700 underline">
              Inicia sesión
            </Link>{" "}
            y vuelve a abrir este enlace para continuar.
          </p>
        </div>
      )}

      {error && <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {user && data && data.valid === false && (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {REASON_LABEL[data.reason ?? ""] ?? "Este certificado no está disponible."}
        </p>
      )}

      {user && data?.valid && data.aggregate && (
        <>
          <section className="rounded-2xl border border-slate-300 bg-white/95 p-4">
            <p className="text-xs text-slate-500">Titular: {data.subjectEmail}</p>
            <div className="mt-1 flex items-center gap-2">
              <StarRating name="cert-overall" value={Math.round(data.aggregate.overallAverage)} readOnly />
              <span className="text-sm font-semibold">{data.aggregate.overallAverage.toFixed(1)} / 5</span>
              <span className="text-xs text-slate-500">· {data.aggregate.totalReviews} calificación(es)</span>
            </div>
          </section>

          {data.aggregate.byDirection.map((d) => (
            <section key={d.direction} className="rounded-2xl border border-slate-200 bg-white/95 p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Como {d.direction === "landlord_to_tenant" ? "arrendatario (inquilino)" : "arrendador (dueño)"}
              </h2>
              <p className="text-xs text-slate-500">
                {d.reviewsCount} calificación(es) · {d.overallAverage.toFixed(1)} / 5
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {d.perCriterion.map((c) => (
                  <li key={c.key} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{c.label}</span>
                    <span className="flex items-center gap-2">
                      <StarRating name={`cert-${d.direction}-${c.key}`} value={Math.round(c.average)} readOnly />
                      <span className="text-xs text-slate-500">{c.average.toFixed(1)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="text-xs text-slate-500">
            El titular compartió voluntariamente esta información. Es un resumen (promedios), no expone quién calificó ni
            el detalle por contrato. Tratamiento conforme a la Ley 1581 de 2012.
          </p>
        </>
      )}
    </main>
  );
}
