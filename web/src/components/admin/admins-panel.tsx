"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type AdminsData = {
  founders: string[];
  envAdmins: string[];
  stored: string[];
  you: string;
};

export function AdminsPanel() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/admins", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; founders?: string[]; envAdmins?: string[]; stored?: string[]; you?: string };
      if (json?.success) {
        setData({ founders: json.founders ?? [], envAdmins: json.envAdmins ?? [], stored: json.stored ?? [], you: json.you ?? "" });
      } else {
        setErr("No se pudo cargar la lista (¿sesión de admin?).");
      }
    } catch {
      setErr("Error de red al cargar administradores.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addAdmin() {
    setMsg(null);
    setErr(null);
    const clean = email.trim().toLowerCase();
    if (!clean) {
      setErr("Escribe un correo.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ email: clean }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setErr(json.errors?.[0]?.message ?? "No se pudo agregar.");
      } else {
        setMsg(`✅ ${clean} ahora es administrador.`);
        setEmail("");
        await load();
      }
    } catch {
      setErr("Error de red al agregar.");
    } finally {
      setLoading(false);
    }
  }

  async function removeAdmin(target: string) {
    setMsg(null);
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/admins?email=${encodeURIComponent(target)}`, {
        method: "DELETE",
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setErr(json.errors?.[0]?.message ?? "No se pudo quitar.");
      } else {
        setMsg(`Se quitó ${target} de administradores.`);
        await load();
      }
    } catch {
      setErr("Error de red al quitar.");
    } finally {
      setLoading(false);
    }
  }

  const rowCls = "flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <h3 className="text-sm font-bold text-violet-900">👥 Administradores del panel</h3>
        <p className="mt-1 text-xs text-slate-600">
          Quién puede entrar a <code>/admin</code>. El acceso se valida en el servidor por correo: solo estas
          personas pueden ver o cambiar algo. Nadie más, aunque tenga cuenta.
        </p>
      </div>

      {/* Agregar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <span className="text-xs font-semibold text-slate-500">Hacer administrador a alguien</span>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void addAdmin()}
            disabled={loading}
            className="shrink-0 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {loading ? "…" : "Hacer administrador"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          La persona debe tener cuenta con ese correo (que haya iniciado sesión al menos una vez). Cerrar y volver
          a abrir sesión ayuda a que el acceso tome efecto.
        </p>
        {msg && <p className="mt-2 text-xs font-semibold text-emerald-700">{msg}</p>}
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {data?.stored?.length ? (
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Agregados desde aquí (puedes quitarlos)</h4>
            <ul className="space-y-2">
              {data.stored.map((e) => (
                <li key={e} className={rowCls}>
                  <span className="truncate text-slate-700">
                    {e} {e === data.you && <span className="text-[11px] text-slate-400">(tú)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeAdmin(e)}
                    disabled={loading}
                    className="shrink-0 rounded-md border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Aún no has agregado administradores desde aquí.</p>
        )}

        <div>
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Fundadores (permanentes)</h4>
          <ul className="space-y-2">
            {(data?.founders ?? []).map((e) => (
              <li key={e} className={`${rowCls} opacity-70`}>
                <span className="truncate text-slate-700">
                  {e} {e === data?.you && <span className="text-[11px] text-slate-400">(tú)</span>}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">no removible</span>
              </li>
            ))}
          </ul>
        </div>

        {data?.envAdmins?.length ? (
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Por configuración del servidor (variable de entorno)</h4>
            <ul className="space-y-2">
              {data.envAdmins.map((e) => (
                <li key={e} className={`${rowCls} opacity-70`}>
                  <span className="truncate text-slate-700">{e}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">se quita en Vercel</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-slate-700">
        <p className="font-semibold text-amber-900">🔒 Seguridad</p>
        <p className="mt-1">
          Cada acción del panel se valida en el servidor contra esta lista. Un usuario que no esté aquí recibe
          “No autorizado”, aunque conozca la dirección <code>/admin</code>. Los fundadores nunca pierden acceso.
        </p>
      </div>
    </div>
  );
}
