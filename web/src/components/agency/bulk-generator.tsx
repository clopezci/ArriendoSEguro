"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Landlord = { id: string; party: { fullName: string; documentNumber: string } };

type RowResult = { index: number; ok: boolean; contractId?: string; tenantName?: string; errors?: { field: string; message: string }[] };

const HEADERS = [
  "tenant_nombre",
  "tenant_tipo_doc",
  "tenant_documento",
  "tenant_ciudad",
  "tenant_email",
  "tenant_telefono",
  "inmueble_direccion",
  "inmueble_ciudad",
  "inmueble_departamento",
  "inmueble_tipo",
  "inmueble_matricula",
  "inmueble_valor_comercial",
  "canon",
  "dia_pago",
  "metodo_pago",
  "fecha_inicio",
  "meses",
] as const;

const TEMPLATE =
  HEADERS.join(",") +
  "\n" +
  "Juan Perez Gomez,CC,1020304050,Medellin,juan@correo.com,3001234567,Calle 10 # 20-30 Apto 302,Medellin,Antioquia,Apartamento,,180000000,1800000,5,Transferencia bancaria,2026-10-01,12\n";

/** Parser CSV mínimo: soporta comas y campos entre comillas dobles. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v.trim() !== "")) rows.push(row); }
  return rows;
}

function num(v: string | undefined): number {
  const digits = String(v ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

type BulkRow = {
  tenant: { fullName: string; documentType: string; documentNumber: string; city: string; email: string; phone: string };
  property: { address: string; city: string; department: string; type: string; registryNumber?: string; commercialValue?: number };
  lease: { monthlyRent: number; paymentDueDay: number; paymentMethod?: string; startDate: string; termMonths: number };
};

function rowsFromCsv(text: string): { rows: BulkRow[]; error?: string } {
  const parsed = parseCsv(text);
  if (parsed.length < 2) return { rows: [], error: "El CSV no tiene filas de datos (revisa el encabezado y al menos una fila)." };
  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const rows: BulkRow[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const c = parsed[i];
    const g = (name: string) => (idx(name) >= 0 ? (c[idx(name)] ?? "").trim() : "");
    rows.push({
      tenant: {
        fullName: g("tenant_nombre"),
        documentType: g("tenant_tipo_doc") || "CC",
        documentNumber: g("tenant_documento"),
        city: g("tenant_ciudad"),
        email: g("tenant_email"),
        phone: g("tenant_telefono"),
      },
      property: {
        address: g("inmueble_direccion"),
        city: g("inmueble_ciudad"),
        department: g("inmueble_departamento"),
        type: g("inmueble_tipo") || "Apartamento",
        registryNumber: g("inmueble_matricula") || undefined,
        commercialValue: num(g("inmueble_valor_comercial")) || undefined,
      },
      lease: {
        monthlyRent: num(g("canon")),
        paymentDueDay: num(g("dia_pago")) || 1,
        paymentMethod: g("metodo_pago") || undefined,
        startDate: g("fecha_inicio"),
        termMonths: num(g("meses")) || 12,
      },
    });
  }
  return { rows };
}

export function BulkGenerator({ agencyId, onGenerated }: { agencyId: string; onGenerated?: () => void }) {
  const { user } = useAuth();
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [landlordId, setLandlordId] = useState("");
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadLandlords = useCallback(async () => {
    const res = await fetch(`/api/agency/${agencyId}/landlords`, { headers: { ...(await buildAuthHeaders(user)) } });
    const json = (await res.json()) as { success?: boolean; landlords?: Landlord[] };
    if (json?.success) setLandlords(json.landlords ?? []);
  }, [agencyId, user]);

  useEffect(() => {
    void loadLandlords();
  }, [loadLandlords]);

  function downloadTemplate() {
    try {
      const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla-contratos-agencia.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  }

  async function generate() {
    setErr(null);
    setResults(null);
    if (!landlordId) { setErr("Elige el arrendador del lote."); return; }
    const { rows, error } = rowsFromCsv(csv);
    if (error) { setErr(error); return; }
    if (rows.length === 0) { setErr("No hay filas para generar."); return; }
    if (rows.length > 100) { setErr("Máximo 100 contratos por lote."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ landlordId, rows }),
      });
      const json = (await res.json()) as { success?: boolean; results?: RowResult[]; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo generar el lote.");
      else {
        setResults(json.results ?? []);
        onGenerated?.();
      }
    } catch {
      setErr("Error de red al generar.");
    } finally {
      setLoading(false);
    }
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = results ? results.length - okCount : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 text-xs text-slate-600">
        <p className="text-sm font-bold text-violet-900">Generar contratos en lote</p>
        <p className="mt-1">
          1) Elige el arrendador. 2) Descarga la plantilla, llénala con tus inquilinos e inmuebles. 3) Súbela o
          pégala aquí y genera. Los contratos quedan como borradores en tu cartera, listos para enviar a firma.
        </p>
        <p className="mt-1 text-[11px] text-slate-400">Si no pones valor comercial, el tope legal del 1% queda bajo tu responsabilidad (la app lo deja constar).</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold text-slate-500">Arrendador del lote</label>
        <select value={landlordId} onChange={(e) => setLandlordId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">— Elige un arrendador —</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>{l.party.fullName} ({l.party.documentNumber})</option>
          ))}
        </select>
        {landlords.length === 0 && <p className="mt-1 text-[11px] text-amber-600">Primero agrega un arrendador en la pestaña “Arrendadores”.</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={downloadTemplate} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            ⬇ Descargar plantilla CSV
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            📄 Subir CSV
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
        </div>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="…o pega aquí el contenido del CSV (con la fila de encabezados)."
          rows={6}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[11px]"
        />

        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="mt-3 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {loading ? "Generando…" : "Generar contratos"}
        </button>
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </div>

      {results && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <p className="font-semibold text-slate-800">
            Resultado: <span className="text-emerald-700">{okCount} creados</span>
            {failCount > 0 && <span className="text-rose-600"> · {failCount} con error</span>}
          </p>
          {failCount > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {results.filter((r) => !r.ok).map((r) => (
                <li key={r.index} className="text-rose-600">
                  Fila {r.index + 1} ({r.tenantName || "?"}): {r.errors?.[0]?.message ?? "error"}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-slate-400">Los contratos creados aparecen en la pestaña “Cartera”.</p>
        </div>
      )}
    </div>
  );
}
