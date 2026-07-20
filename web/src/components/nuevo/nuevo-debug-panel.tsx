"use client";

import { useEffect, useState } from "react";
import { getDebugLog, clearDebugLog, isDebugOn, initDebugFromUrl, type DebugEntry } from "@/lib/nuevo/debug-log";

/**
 * Panel de diagnóstico visible del flujo /nuevo. Solo aparece con ?debug=1.
 * Muestra la secuencia de eventos (persistida en sessionStorage, sobrevive al
 * redirect de Google) para poder ver dónde cae a "home".
 */
export function NuevoDebugPanel() {
  const [on, setOn] = useState(false);
  const [entries, setEntries] = useState<DebugEntry[]>([]);

  useEffect(() => {
    initDebugFromUrl();
    setOn(isDebugOn());
    const refresh = () => setEntries(getDebugLog());
    refresh();
    const id = window.setInterval(refresh, 500);
    return () => window.clearInterval(id);
  }, []);

  if (!on) return null;

  return (
    <div className="fixed bottom-2 right-2 z-[200] max-h-[50vh] w-[92vw] max-w-md overflow-auto rounded-xl border-2 border-amber-400 bg-white/95 p-2 text-[11px] shadow-2xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-black text-amber-700">DEBUG /nuevo ({entries.length})</span>
        <button
          type="button"
          onClick={() => {
            clearDebugLog();
            setEntries([]);
          }}
          className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800"
        >
          Limpiar
        </button>
      </div>
      <ol className="space-y-0.5 font-mono">
        {entries.map((e, i) => (
          <li key={i} className="break-words">
            <span className="text-slate-400">{e.t}</span>{" "}
            <span className="font-bold text-slate-800">{e.ev}</span>
            {e.data !== undefined && e.data !== null ? (
              <span className="text-violet-700"> {JSON.stringify(e.data)}</span>
            ) : null}
          </li>
        ))}
        {entries.length === 0 ? <li className="text-slate-400">sin eventos aún…</li> : null}
      </ol>
    </div>
  );
}
