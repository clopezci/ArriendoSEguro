"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardPayload = {
  success: boolean;
  features?: { manualGrantPlus: boolean };
  summary?: {
    usersRegistered: number | null;
    surveysResponded: number | null;
    demoAccessesActive: number | null;
    plusAccessesActive: number | null;
    expedientesCreados: number | null;
    contractVersions: number | null;
    platformPaymentsApproved: number | null;
    recentErrors: { eventName: string; createdAt: string; metadataSummary: string }[];
  };
  surveys?: Record<string, unknown>[];
  users?: Record<string, unknown>[];
  accesses?: Record<string, unknown>[];
  platformOrders?: Record<string, unknown>[];
  platformPayments?: Record<string, unknown>[];
  expedientes?: Record<string, unknown>[];
  audit?: Record<string, unknown>[];
  errors?: { message: string }[];
};

function publicAdminHintEmails(): string[] {
  if (typeof window === "undefined") return [];
  const raw = process.env.NEXT_PUBLIC_ADMIN_INTERNAL_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<
    "resumen" | "encuestas" | "usuarios" | "accesos" | "pagos" | "expedientes" | "auditoria"
  >("resumen");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [grantEmail, setGrantEmail] = useState("");
  const [grantMsg, setGrantMsg] = useState("");
  const [grantErr, setGrantErr] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);

  const hintSet = useMemo(() => new Set(publicAdminHintEmails()), []);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/ingresar?redirect=${encodeURIComponent("/admin")}`);
    }
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError("");
    try {
      const res = await fetch("/api/admin/dashboard", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as DashboardPayload;
      if (res.status === 403) {
        setLoadError("No autorizado: tu cuenta no está en la lista de administradores del servidor.");
        setData(null);
        return;
      }
      if (!res.ok || !json.success) {
        setLoadError(json.errors?.[0]?.message ?? "No se pudo cargar el panel.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setLoadError("Error de red al cargar el panel.");
      setData(null);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadSurveysCsv() {
    if (!user) return;
    const res = await fetch("/api/admin/surveys-export", { headers: { ...(await buildAuthHeaders(user)) } });
    if (!res.ok) {
      setLoadError("No se pudo exportar CSV (revisa permisos).");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "encuestas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function grantPlus() {
    if (!user) return;
    setGrantLoading(true);
    setGrantMsg("");
    setGrantErr("");
    try {
      const res = await fetch("/api/platform-payments/internal/grant-plus", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ email: grantEmail.trim(), validDays: 365 }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message: string }[] };
      if (!res.ok || !json.success) {
        setGrantErr(json.errors?.[0]?.message ?? "No se pudo otorgar Plus.");
        return;
      }
      setGrantMsg("Plan Plus manual otorgado (revisa entitlements).");
      setGrantEmail("");
      await load();
    } catch {
      setGrantErr("Error de red.");
    } finally {
      setGrantLoading(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-950 text-slate-400">
        <p className="text-sm">Cargando sesión…</p>
      </div>
    );
  }

  const emailLc = user.email?.toLowerCase() ?? "";
  const hintMismatch = mounted && hintSet.size > 0 && !hintSet.has(emailLc);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-400">Herramienta interna</p>
            <h1 className="text-2xl font-bold text-white">Panel administrativo</h1>
            <p className="mt-1 text-xs text-slate-500">
              Acceso validado en el servidor con <code className="text-slate-400">ADMIN_INTERNAL_EMAILS</code>. No
              confíes solo en el navegador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
            >
              Actualizar
            </button>
            <Link href="/dashboard" className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200">
              Ir al dashboard
            </Link>
          </div>
        </header>

        {hintMismatch && (
          <p className="mb-4 rounded-lg border border-amber-700/40 bg-amber-950/30 p-2 text-xs text-amber-100">
            Aviso: tu correo no coincide con <code>NEXT_PUBLIC_ADMIN_INTERNAL_EMAILS</code> (solo referencia UI). La
            autorización real la define el servidor.
          </p>
        )}

        {loadError && (
          <div className="mb-4 rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-100">
            {loadError}
          </div>
        )}

        {data?.features?.manualGrantPlus && (
          <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">Habilitar Plan Plus manual</h2>
            <p className="mt-1 text-xs text-slate-500">
              Requiere <code className="text-slate-400">ADMIN_INTERNAL_ENABLED=true</code> en servidor (o entorno
              desarrollo). El usuario debe existir en Firebase Auth.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="correo@usuario.com"
                className="min-w-[200px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={grantLoading || !grantEmail.trim()}
                onClick={() => void grantPlus()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {grantLoading ? "…" : "Otorgar Plus"}
              </button>
            </div>
            {grantMsg && <p className="mt-2 text-xs text-emerald-400">{grantMsg}</p>}
            {grantErr && <p className="mt-2 text-xs text-rose-400">{grantErr}</p>}
          </section>
        )}

        <nav className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["resumen", "Resumen"],
              ["encuestas", "Encuestas"],
              ["usuarios", "Usuarios"],
              ["accesos", "Accesos"],
              ["pagos", "Pagos plataforma"],
              ["expedientes", "Expedientes"],
              ["auditoria", "Auditoría"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                tab === id ? "border-violet-500 bg-violet-950/50 text-violet-100" : "border-slate-700 text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {!data && !loadError && <p className="text-sm text-slate-500">Cargando datos…</p>}

        {data && tab === "resumen" && <Resumen s={data.summary} />}
        {data && tab === "encuestas" && (
          <Encuestas rows={data.surveys ?? []} onExport={() => void downloadSurveysCsv()} />
        )}
        {data && tab === "usuarios" && <TablaGenerica rows={data.users ?? []} />}
        {data && tab === "accesos" && <TablaGenerica rows={data.accesses ?? []} />}
        {data && tab === "pagos" && (
          <div className="space-y-6">
            <h3 className="text-xs font-semibold uppercase text-slate-500">Órdenes</h3>
            <TablaGenerica rows={data.platformOrders ?? []} />
            <h3 className="text-xs font-semibold uppercase text-slate-500">Pagos</h3>
            <TablaGenerica rows={data.platformPayments ?? []} />
          </div>
        )}
        {data && tab === "expedientes" && <TablaGenerica rows={data.expedientes ?? []} />}
        {data && tab === "auditoria" && <TablaGenerica rows={data.audit ?? []} />}
      </div>
    </div>
  );
}

function Resumen({ s }: { s?: DashboardPayload["summary"] }) {
  if (!s) return null;
  const cards = [
    ["Usuarios registrados (Auth)", s.usersRegistered],
    ["Encuestas (Firestore)", s.surveysResponded],
    ["Accesos demo activos", s.demoAccessesActive],
    ["Accesos Plus activos", s.plusAccessesActive],
    ["Expedientes / contratos (docs)", s.expedientesCreados],
    ["Versiones de contrato", s.contractVersions],
    ["Pagos plataforma aprobados", s.platformPaymentsApproved],
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, val]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{val ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-sm font-semibold text-white">Errores recientes (heurística sobre auditoría)</p>
        {s.recentErrors.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Sin coincidencias en los últimos eventos cargados.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            {s.recentErrors.map((e, i) => (
              <li key={i}>
                <span className="text-slate-300">{e.eventName}</span> · {e.createdAt}{" "}
                {e.metadataSummary ? `· ${e.metadataSummary}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Encuestas({ rows, onExport }: { rows: Record<string, unknown>[]; onExport: () => void }) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onExport}
        className="rounded-lg border border-violet-600/50 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-950/60"
      >
        Exportar CSV
      </button>
      <TablaGenerica rows={rows} tableStyle="surveys" />
    </div>
  );
}

function TablaGenerica({
  rows,
  tableStyle = "default",
}: {
  rows: Record<string, unknown>[];
  tableStyle?: "default" | "surveys";
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">Sin filas.</p>;
  }
  const keys = Object.keys(rows[0] ?? {});
  const isSurveys = tableStyle === "surveys";
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table
        className={`w-full border-collapse text-left text-xs ${isSurveys ? "min-w-[1100px]" : "min-w-[640px]"}`}
      >
        <thead
          className={`border-b border-slate-800 bg-slate-950/80 text-[10px] font-medium ${
            isSurveys ? "normal-case leading-tight text-slate-400" : "uppercase text-slate-500"
          }`}
        >
          <tr>
            {keys.map((k) => (
              <th key={k} className={`px-2 py-2 align-bottom ${isSurveys ? "max-w-[11rem] whitespace-normal" : ""}`}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800/80 odd:bg-slate-900/40">
              {keys.map((k) => (
                <td
                  key={k}
                  className={`px-2 py-1.5 align-top text-slate-300 ${
                    isSurveys ? "max-w-[14rem] break-words whitespace-normal" : "max-w-[220px] truncate"
                  }`}
                  title={String(row[k] ?? "")}
                >
                  {formatCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (v == null) return "";
  return String(v);
}
