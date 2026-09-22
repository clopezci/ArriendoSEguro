"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { AgencyPlansEditor } from "@/components/admin/agency-plans-editor";

type AgencyRow = {
  id: string;
  name: string;
  nit?: string;
  contactEmail: string;
  contactPhone?: string;
  escalationEmail?: string;
  identityEnabled?: boolean;
  whatsappNumber?: string;
  memberEmails: string[];
  status: "active" | "suspended";
  credits: number;
  createdAt: string;
  origin?: "admin" | "self_signup";
  trial?: { active: boolean; startedAt: string; creditsGranted: number };
  suspendedMessage?: string;
};

export function AgenciasPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [onlyTrial, setOnlyTrial] = useState(false);

  // Formulario de creación.
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [escalationEmail, setEscalationEmail] = useState("");
  const [nit, setNit] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/agencies", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; agencies?: AgencyRow[] };
      if (json?.success) setRows(json.agencies ?? []);
      else setErr("No se pudo cargar (¿sesión de admin?).");
    } catch {
      setErr("Error de red al cargar agencias.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAgency() {
    setMsg(null);
    setErr(null);
    if (!name.trim() || !contactEmail.trim() || !escalationEmail.trim()) {
      setErr("Nombre, correo de contacto y correo de escalamiento son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/agencies", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: contactEmail.trim(),
          escalationEmail: escalationEmail.trim(),
          nit: nit.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setErr(json.errors?.[0]?.message ?? "No se pudo crear la agencia.");
      } else {
        setMsg(`✅ Agencia "${name.trim()}" creada.`);
        setName("");
        setContactEmail("");
        setEscalationEmail("");
        setNit("");
        setContactPhone("");
        await load();
      }
    } catch {
      setErr("Error de red al crear.");
    } finally {
      setLoading(false);
    }
  }

  async function patchAgency(agencyId: string, patch: Record<string, unknown>, okMsg: string) {
    setMsg(null);
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/agencies", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ agencyId, ...patch }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo actualizar.");
      else {
        setMsg(okMsg);
        await load();
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <h3 className="text-sm font-bold text-violet-900">🏢 Agencias</h3>
        <p className="mt-1 text-xs text-slate-600">
          Arrendadoras e inmobiliarias que trabajan contratos en volumen. Crea la agencia, agrega a sus
          usuarios (por correo) y asígnale créditos prepago. Cada agencia entra a su panel en <code>/agency</code>.
        </p>
      </div>

      <AgencyPlansEditor />

      {/* Crear agencia */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <span className="text-xs font-semibold text-slate-500">Crear agencia</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la agencia" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Correo de contacto (será miembro)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="email" value={escalationEmail} onChange={(e) => setEscalationEmail(e.target.value)} placeholder="Correo de escalamiento/PQR (fraude) *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="NIT (opcional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Teléfono (opcional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button
          type="button"
          onClick={() => void createAgency()}
          disabled={loading}
          className="mt-3 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {loading ? "…" : "Crear agencia"}
        </button>
        {msg && <p className="mt-2 text-xs font-semibold text-emerald-700">{msg}</p>}
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase text-slate-500">
            Agencias ({rows.length}) · en prueba: {rows.filter((r) => r.trial?.active).length}
          </h4>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={onlyTrial} onChange={(e) => setOnlyTrial(e.target.checked)} className="h-3.5 w-3.5" />
            Ver solo en prueba
          </label>
        </div>
        {rows.length === 0 && <p className="text-xs text-slate-400">Aún no hay agencias.</p>}
        {(onlyTrial ? rows.filter((r) => r.trial?.active) : rows).map((a) => (
          <AgencyCard key={a.id} agency={a} loading={loading} onPatch={patchAgency} />
        ))}
      </div>
    </div>
  );
}

function AgencyCard({
  agency,
  loading,
  onPatch,
}: {
  agency: AgencyRow;
  loading: boolean;
  onPatch: (agencyId: string, patch: Record<string, unknown>, okMsg: string) => void | Promise<void>;
}) {
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [newMember, setNewMember] = useState("");
  const [revokeMsg, setRevokeMsg] = useState("");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-800">{agency.name}</span>
          {agency.nit && <span className="ml-2 text-xs text-slate-400">NIT {agency.nit}</span>}
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              agency.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            {agency.status === "active" ? "activa" : "suspendida"}
          </span>
          {agency.trial?.active && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">en prueba</span>
          )}
          {agency.origin === "self_signup" && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">auto-registro</span>
          )}
        </div>
        <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
          {agency.credits} créditos
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{agency.contactEmail}{agency.contactPhone ? ` · ${agency.contactPhone}` : ""}</p>
      <p className="mt-1 text-[11px] text-slate-400">
        Escalamiento/PQR: {agency.escalationEmail ? <span className="text-slate-600">{agency.escalationEmail}</span> : <span className="text-rose-500">falta (obligatorio)</span>}
        {" · "}Identidad:{" "}
        <span className={agency.identityEnabled === false ? "text-slate-500" : "text-emerald-600"}>{agency.identityEnabled === false ? "apagada" : "activa"}</span>
      </p>
      <p className="mt-1 text-[11px] text-slate-400">Miembros: {agency.memberEmails.join(", ") || "—"}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          value={creditsToAdd}
          onChange={(e) => setCreditsToAdd(e.target.value)}
          placeholder="Créditos"
          className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={loading || !creditsToAdd}
          onClick={() => {
            const n = Math.floor(Number(creditsToAdd));
            if (n > 0) void onPatch(agency.id, { addCredits: n }, `✅ +${n} créditos a ${agency.name}.`);
            setCreditsToAdd("");
          }}
          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
        >
          Asignar créditos
        </button>

        <input
          type="email"
          value={newMember}
          onChange={(e) => setNewMember(e.target.value)}
          placeholder="Agregar miembro (correo)"
          className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={loading || !newMember}
          onClick={() => {
            const email = newMember.trim().toLowerCase();
            if (email) {
              const next = Array.from(new Set([...agency.memberEmails, email]));
              void onPatch(agency.id, { memberEmails: next }, `✅ ${email} agregado a ${agency.name}.`);
            }
            setNewMember("");
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Agregar miembro
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            void onPatch(
              agency.id,
              { identityEnabled: agency.identityEnabled === false },
              `Identidad ${agency.identityEnabled === false ? "activada" : "apagada"} para ${agency.name}.`,
            )
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          {agency.identityEnabled === false ? "Activar identidad" : "Apagar identidad"}
        </button>

        {agency.status !== "active" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void onPatch(agency.id, { status: "active" }, `Agencia ${agency.name} reactivada.`)}
            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
          >
            Reactivar
          </button>
        )}
      </div>

      {/* Revocar / suspender con mensaje que le llega a la agencia por correo. */}
      {agency.status === "active" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-2.5">
          <input
            type="text"
            value={revokeMsg}
            onChange={(e) => setRevokeMsg(e.target.value)}
            placeholder="Mensaje para la agencia (opcional)"
            maxLength={500}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              const note = revokeMsg.trim();
              void onPatch(
                agency.id,
                { status: "suspended", ...(note ? { notifyMessage: note } : {}) },
                `Prueba de ${agency.name} revocada${note ? " (se le envió el mensaje)" : ""}.`,
              );
              setRevokeMsg("");
            }}
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
          >
            Revocar prueba
          </button>
        </div>
      )}
      {agency.status !== "active" && agency.suspendedMessage && (
        <p className="mt-2 text-[11px] text-slate-400">Mensaje enviado: “{agency.suspendedMessage}”</p>
      )}
    </div>
  );
}
