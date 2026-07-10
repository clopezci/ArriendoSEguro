"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Cell = string | number | boolean | null;
type ExportSection = {
  key: string;
  title: string;
  description?: string;
  columns: string[];
  rows: Record<string, Cell>[];
};
type ExportResponse = {
  success: boolean;
  generatedAt?: string;
  subject?: { uid: string; email: string };
  legalBasis?: string;
  sections?: ExportSection[];
  errors?: { message?: string }[];
};

/** Escapa un valor para CSV (comillas y separadores). */
function csvCell(v: Cell): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function buildCsv(data: ExportResponse): string {
  const lines: string[] = [];
  lines.push(`Reporte de datos personales — ArriendoSeguro`);
  lines.push(`Titular;${csvCell(data.subject?.email ?? "")}`);
  lines.push(`Generado;${csvCell(data.generatedAt ?? "")}`);
  lines.push(`Base legal;${csvCell(data.legalBasis ?? "")}`);
  lines.push("");
  for (const s of data.sections ?? []) {
    lines.push(`## ${s.title}`);
    lines.push(s.columns.map(csvCell).join(";"));
    if (s.rows.length === 0) lines.push("(sin registros)");
    for (const r of s.rows) lines.push(s.columns.map((c) => csvCell(r[c] ?? "")).join(";"));
    lines.push("");
  }
  return lines.join("\r\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob(["﻿", content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function MisDatosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ExportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/ingresar?redirect=${encodeURIComponent("/dashboard/cuenta/mis-datos")}`);
    }
  }, [user, loading, router]);

  async function generate() {
    if (!user) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/cuenta/mis-datos", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as ExportResponse;
      if (!res.ok || !json.success) {
        setErr(json.errors?.[0]?.message ?? "No se pudo generar el reporte. Intenta de nuevo.");
        return;
      }
      setData(json);
    } catch {
      setErr("Error de red al generar el reporte. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const stamp = (data?.generatedAt ?? "").slice(0, 10) || "reporte";

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        <p>Cargando sesión…</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Habeas Data · Derecho de acceso</p>
        <h1 className="text-2xl font-bold">Solicitar mis datos</h1>
        <p className="text-sm text-slate-600">
          Genera y descarga, al instante, una copia de los datos personales que la plataforma tiene sobre ti (Ley 1581
          de 2012, art. 8). No necesitas escribir correos ni esperar: el reporte se arma automáticamente con tu sesión.
        </p>
        <Link href="/dashboard/account" className="inline-block text-sm text-violet-700 underline">
          Volver a mi cuenta
        </Link>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {busy ? "Generando…" : data ? "Actualizar reporte" : "Generar mi reporte de datos"}
          </button>
          {data && (
            <>
              <button
                type="button"
                onClick={() => download(`mis-datos-${stamp}.csv`, buildCsv(data), "text/csv")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:border-violet-500"
              >
                Descargar CSV (Excel)
              </button>
              <button
                type="button"
                onClick={() => download(`mis-datos-${stamp}.json`, JSON.stringify(data, null, 2), "application/json")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:border-violet-500"
              >
                Descargar JSON
              </button>
            </>
          )}
        </div>
        {err && (
          <p className="mt-3 text-sm text-rose-700" role="alert">
            {err}
          </p>
        )}
        {data?.generatedAt && (
          <p className="mt-3 text-xs text-slate-500">
            Generado el {new Date(data.generatedAt).toLocaleString("es-CO")} para {data.subject?.email}.
          </p>
        )}
      </section>

      {data?.sections?.map((s) => (
        <section key={s.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
          {s.description && <p className="mt-1 text-sm text-slate-600">{s.description}</p>}
          {s.rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Sin registros.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-[11px] uppercase tracking-wide text-slate-500">
                    {s.columns.map((c) => (
                      <th key={c} className="px-2 py-2 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      {s.columns.map((c) => (
                        <td key={c} className="max-w-[22rem] break-words px-2 py-2 text-slate-800">
                          {String(r[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-500">
        <p>
          Este reporte cubre el <strong>derecho de acceso</strong>. Para rectificar, actualizar, suprimir o revocar el
          consentimiento, usa las opciones de tu cuenta o los canales del{" "}
          <Link href="/legal/aviso-privacidad" className="text-violet-700 underline">
            aviso de privacidad
          </Link>
          . Para eliminar tu cuenta, ve a{" "}
          <Link href="/dashboard/cuenta/eliminar" className="text-violet-700 underline">
            Eliminar mi cuenta
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
