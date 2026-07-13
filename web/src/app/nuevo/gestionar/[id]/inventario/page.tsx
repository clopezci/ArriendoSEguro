"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useSavedContract } from "@/components/contracts/requires-saved-contract";
import { InventoryZonePhotos } from "@/components/contracts/inventory-zone-photos";
import { GUIDED_ZONE_OPTIONS, GUIDED_ITEMS_BY_ZONE, FALLBACK_GUIDED_ITEMS } from "@/domain/inventory/inventoryRules";

/**
 * Inventario y acta de entrega en estilo BENTO ("una cosa a la vez"). Reutiliza
 * los MISMOS endpoints del flujo existente (/api/inventory/* y
 * /api/delivery-act/generate): crear → elegir zonas → estado por zona →
 * completar (complete-guided) → generar acta. Sin cambiar la lógica de negocio.
 */
const CONDITIONS = ["Excelente", "Bueno", "Aceptable", "Regular", "Malo", "No aplica"] as const;
const CLEANLINESS = ["Limpio", "Aceptable", "Sucio", "No aplica"] as const;
// Estado de cada elemento (valor guardado → etiqueta que ve el usuario).
const ITEM_CONDITIONS: Array<{ value: string; label: string }> = [
  { value: "excellent", label: "Excelente" },
  { value: "good", label: "Bueno" },
  { value: "fair", label: "Aceptable" },
  { value: "poor", label: "Regular" },
  { value: "damaged", label: "Malo" },
  { value: "not_applicable", label: "No aplica" },
];

type Phase = "loading" | "locked" | "intro" | "zones" | "fill" | "review" | "done";
type ZoneRow = { id: string; zoneName: string };
type ItemRow = { itemName: string; conditionStatus: string; notes: string };
type ZoneData = { generalCondition: string; cleanlinessStatus: string; observations: string; photoUrls: string[]; items: ItemRow[] };

function chip(sel: boolean) {
  return `rounded-2xl border-2 px-4 py-2.5 text-sm font-medium transition ${sel ? "border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-700 hover:border-[#5646E5]"}`;
}

export default function InventarioBentoPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const sc = useSavedContract(id);
  const versionId = sc.currentVersionId ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [inventoryId, setInventoryId] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [zi, setZi] = useState(0);
  const [data, setData] = useState<Record<string, ZoneData>>({});
  // Acta
  const [actObservations, setActObservations] = useState("");
  const [actDate, setActDate] = useState("");
  const [actDone, setActDone] = useState(false);

  const authHeaders = useCallback(async () => (user ? await buildAuthHeaders(user) : {}), [user]);

  useEffect(() => {
    if (sc.status === "loading") return;
    if (sc.status !== "saved" || !versionId) { setPhase("locked"); return; }
    setPhase("intro");
  }, [sc.status, versionId]);

  async function start() {
    if (!versionId) return;
    setBusy(true); setMsg("");
    try {
      const h = { "content-type": "application/json", ...(await authHeaders()) };
      // Reusar el inventario inicial si ya existe.
      let invId = "";
      try {
        const r = await fetch(`/api/inventory/by-contract?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`);
        const j = (await r.json()) as { success?: boolean; inventory?: { id?: string } | null };
        if (r.ok && j.success && j.inventory?.id) invId = j.inventory.id;
      } catch { /* noop */ }
      if (!invId) {
        const r = await fetch("/api/inventory/create", {
          method: "POST", headers: h,
          body: JSON.stringify({ leaseProcessId: id, contractId: id, contractVersionId: versionId, inventoryType: "initial" }),
        });
        const j = (await r.json()) as { success?: boolean; inventoryId?: string; errors?: { message?: string }[] };
        if (!r.ok || !j.success || !j.inventoryId) {
          setMsg(j.errors?.[0]?.message ?? "No se pudo crear el inventario. (Requiere Plan Plus.)");
          return;
        }
        invId = j.inventoryId;
      }
      setInventoryId(invId);
      setPhase("zones");
    } catch {
      setMsg("Error de red al iniciar el inventario.");
    } finally {
      setBusy(false);
    }
  }

  function toggleZone(z: string) {
    setSelected((s) => (s.includes(z) ? s.filter((x) => x !== z) : [...s, z]));
  }

  async function confirmZones() {
    if (selected.length === 0) { setMsg("Elige al menos una zona."); return; }
    setBusy(true); setMsg("");
    try {
      const h = { "content-type": "application/json", ...(await authHeaders()) };
      const payloadZones = selected.map((z, idx) => ({ zoneCode: z.toLowerCase().replaceAll(" ", "_"), zoneName: z, order: idx }));
      const r = await fetch("/api/inventory/select-zones", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inventoryId, zones: payloadZones }) });
      const j = (await r.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!r.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudieron guardar las zonas."); return; }
      // Releer para obtener los ids reales de cada zona.
      const dr = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(inventoryId)}`, { headers: h });
      const dj = (await dr.json()) as {
        success?: boolean;
        selectedZones?: Array<{ id: string; zoneName: string; status?: string }>;
        zoneDetails?: Array<{ selectedZoneId: string; generalCondition?: string; cleanlinessStatus?: string; observations?: string; photoUrls?: string[] }>;
        zoneItems?: Array<{ selectedZoneId: string; itemName?: string; conditionStatus?: string; notes?: string }>;
      };
      const rows = (dj.selectedZones ?? []).filter((z) => z.status !== "skipped").map((z) => ({ id: z.id, zoneName: z.zoneName }));
      if (rows.length === 0) { setMsg("No se pudieron cargar las zonas."); return; }
      // Prellenar lo que ya se hubiera guardado (para retomar sin perder fotos/estado/ítems).
      const itemsByZone: Record<string, ItemRow[]> = {};
      for (const it of dj.zoneItems ?? []) {
        (itemsByZone[it.selectedZoneId] ??= []).push({ itemName: it.itemName ?? "", conditionStatus: it.conditionStatus ?? "good", notes: it.notes ?? "" });
      }
      const prefill: Record<string, ZoneData> = {};
      for (const zd of dj.zoneDetails ?? []) {
        prefill[zd.selectedZoneId] = {
          generalCondition: zd.generalCondition ?? "",
          cleanlinessStatus: zd.cleanlinessStatus ?? "",
          observations: zd.observations ?? "",
          photoUrls: Array.isArray(zd.photoUrls) ? zd.photoUrls : [],
          items: itemsByZone[zd.selectedZoneId] ?? [],
        };
      }
      setData(prefill);
      setZones(rows);
      setZi(0);
      setPhase("fill");
    } catch {
      setMsg("Error de red al guardar las zonas.");
    } finally {
      setBusy(false);
    }
  }

  const cur = zones[zi];
  const curData = (cur && data[cur.id]) || { generalCondition: "", cleanlinessStatus: "", observations: "", photoUrls: [], items: [] };
  function setCur(patch: Partial<ZoneData>) {
    if (!cur) return;
    setData((d) => ({ ...d, [cur.id]: { ...curData, ...patch } }));
  }

  async function saveZoneAndNext() {
    if (!cur) return;
    if (!curData.generalCondition || !curData.cleanlinessStatus) { setMsg("Indica el estado general y la limpieza de la zona."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/inventory/save-zone-detail", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId, selectedZoneId: cur.id, generalCondition: curData.generalCondition, cleanlinessStatus: curData.cleanlinessStatus, observations: curData.observations, photoUrls: curData.photoUrls, status: "completed" }),
      });
      const j = (await r.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!r.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo guardar la zona."); return; }
      // Guardar los elementos de la zona (los que tengan nombre).
      const items = curData.items.filter((it) => it.itemName.trim().length > 0).map((it) => ({ itemName: it.itemName.trim(), conditionStatus: it.conditionStatus, notes: it.notes }));
      await fetch("/api/inventory/save-zone-items", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId, selectedZoneId: cur.id, items }),
      }).catch(() => {});
      if (zi < zones.length - 1) setZi(zi + 1);
      else setPhase("review");
    } catch {
      setMsg("Error de red al guardar la zona.");
    } finally {
      setBusy(false);
    }
  }

  async function finishInventory() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/inventory/complete-guided", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inventoryId }) });
      const j = (await r.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!r.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo finalizar el inventario."); return; }
      setMsg("Inventario finalizado ✓. Ahora genera el acta de entrega.");
    } catch {
      setMsg("Error de red al finalizar el inventario.");
    } finally {
      setBusy(false);
    }
  }

  async function generateAct() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/delivery-act/generate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId, contractId: id, contractVersionId: versionId, observations: actObservations || undefined, deliveryDate: actDate || undefined }),
      });
      const j = (await r.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!r.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo generar el acta (¿inventario completado?)."); return; }
      setActDone(true);
      setPhase("done");
    } catch {
      setMsg("Error de red al generar el acta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#37D0E8,#3A7BFF)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/nuevo/gestionar/${id}`} className="text-sm font-semibold text-[#5646E5] hover:underline">← Gestionar</Link>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Inventario y acta</span>
        </div>

        <h1 className="text-balance text-3xl font-extrabold tracking-tight">Inventario y acta de entrega</h1>

        {phase === "loading" && <p className="mt-6 text-slate-400">Cargando…</p>}

        {phase === "locked" && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/70 p-6 text-amber-900">
            <p className="font-bold">Primero guarda el contrato</p>
            <p className="mt-1 text-sm">El inventario y el acta se habilitan cuando el contrato está guardado (Plan Plus). Vuelve a “Gestionar” y finaliza el contrato.</p>
          </div>
        )}

        {phase === "intro" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-3xl border border-slate-200 bg-white/90 p-6">
            <p className="text-lg font-semibold">Vamos a registrar el estado del inmueble, zona por zona.</p>
            <p className="mt-2 text-sm text-slate-500">Eliges las zonas, marcas cómo está cada una y al final se genera el <b>acta de entrega</b> (Anexo No. 2) y se envía a ambas partes por correo.</p>
            <button onClick={() => void start()} disabled={busy} className="mt-5 rounded-2xl bg-[#FF6B4A] px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95 disabled:opacity-50">
              {busy ? "Preparando…" : "Empezar inventario →"}
            </button>
          </motion.div>
        )}

        {phase === "zones" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <p className="text-sm font-medium text-slate-600">¿Qué zonas tiene el inmueble? Toca las que apliquen.</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {GUIDED_ZONE_OPTIONS.map((z) => (
                <button key={z} type="button" onClick={() => toggleZone(z)} className={chip(selected.includes(z))}>{z}</button>
              ))}
            </div>
            <button onClick={() => void confirmZones()} disabled={busy} className="mt-6 rounded-2xl bg-[#5646E5] px-7 py-4 text-base font-bold text-white transition hover:brightness-105 active:scale-95 disabled:opacity-50">
              {busy ? "Guardando…" : `Continuar (${selected.length}) →`}
            </button>
          </motion.div>
        )}

        {phase === "fill" && cur && (
          <motion.div key={cur.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Zona {zi + 1} de {zones.length}</p>
            <h2 className="text-2xl font-bold tracking-tight">{cur.zoneName}</h2>

            <p className="mt-4 mb-1.5 text-sm font-medium text-slate-600">Estado general</p>
            <div className="flex flex-wrap gap-2.5">
              {CONDITIONS.map((c) => <button key={c} type="button" onClick={() => setCur({ generalCondition: c })} className={chip(curData.generalCondition === c)}>{c}</button>)}
            </div>

            <p className="mt-4 mb-1.5 text-sm font-medium text-slate-600">Limpieza</p>
            <div className="flex flex-wrap gap-2.5">
              {CLEANLINESS.map((c) => <button key={c} type="button" onClick={() => setCur({ cleanlinessStatus: c })} className={chip(curData.cleanlinessStatus === c)}>{c}</button>)}
            </div>

            <p className="mt-4 mb-1.5 text-sm font-medium text-slate-600">Elementos de la zona (detalle)</p>
            <p className="mb-2 text-xs text-slate-500">Toca una sugerencia para agregarla, o añade el tuyo. Marca el estado de cada elemento.</p>
            <div className="flex flex-wrap gap-2">
              {(GUIDED_ITEMS_BY_ZONE[cur.zoneName] ?? FALLBACK_GUIDED_ITEMS)
                .filter((s) => !curData.items.some((it) => it.itemName.toLowerCase() === s.toLowerCase()))
                .map((s) => (
                  <button key={s} type="button" onClick={() => setCur({ items: [...curData.items, { itemName: s, conditionStatus: "good", notes: "" }] })}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5]">
                    + {s}
                  </button>
                ))}
              <button type="button" onClick={() => setCur({ items: [...curData.items, { itemName: "", conditionStatus: "good", notes: "" }] })}
                className="rounded-full border-2 border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-[#5646E5] hover:text-[#5646E5]">
                + Otro elemento
              </button>
            </div>

            {curData.items.length > 0 && (
              <div className="mt-3 space-y-2">
                {curData.items.map((it, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                    <div className="flex items-center gap-2">
                      <input value={it.itemName} onChange={(e) => setCur({ items: curData.items.map((x, j) => (j === idx ? { ...x, itemName: e.target.value } : x)) })}
                        placeholder="Nombre del elemento" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#5646E5]" />
                      <select value={it.conditionStatus} onChange={(e) => setCur({ items: curData.items.map((x, j) => (j === idx ? { ...x, conditionStatus: e.target.value } : x)) })}
                        className="flex-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                        {ITEM_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <button type="button" onClick={() => setCur({ items: curData.items.filter((_, j) => j !== idx) })}
                        className="flex-none rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-bold text-rose-600" aria-label="Quitar elemento">×</button>
                    </div>
                    <input value={it.notes} onChange={(e) => setCur({ items: curData.items.map((x, j) => (j === idx ? { ...x, notes: e.target.value } : x)) })}
                      placeholder="Notas (opcional)" className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#5646E5]" />
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 mb-1.5 text-sm font-medium text-slate-600">Observaciones (opcional)</p>
            <textarea value={curData.observations} onChange={(e) => setCur({ observations: e.target.value })} rows={3} placeholder="Daños, detalles, elementos entregados…" className="w-full rounded-2xl border-2 border-slate-200 p-3 text-sm outline-none focus:border-[#5646E5]" />

            <div className="mt-4 rounded-2xl border-2 border-slate-200 bg-white/70 p-3">
              <InventoryZonePhotos inventoryId={inventoryId} zoneId={cur.id} photoUrls={curData.photoUrls} onChange={(next) => setCur({ photoUrls: next })} />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => void saveZoneAndNext()} disabled={busy} className="rounded-2xl bg-[#5646E5] px-7 py-4 text-base font-bold text-white transition hover:brightness-105 active:scale-95 disabled:opacity-50">
                {busy ? "Guardando…" : zi < zones.length - 1 ? "Guardar y siguiente →" : "Guardar y finalizar →"}
              </button>
              {zi > 0 && <button onClick={() => setZi(zi - 1)} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-600">← Atrás</button>}
            </div>
          </motion.div>
        )}

        {phase === "review" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5">
              <p className="text-lg font-semibold">Revisa y finaliza el inventario</p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                {zones.map((z) => (
                  <li key={z.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span>{z.zoneName}</span>
                    <span className="text-xs text-slate-500">{data[z.id]?.generalCondition || "—"} · {data[z.id]?.cleanlinessStatus || "—"}{(data[z.id]?.photoUrls?.length ?? 0) > 0 ? ` · 📷 ${data[z.id]?.photoUrls.length}` : ""}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => void finishInventory()} disabled={busy} className="mt-4 rounded-2xl bg-[#12B886] px-6 py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50">
                {busy ? "Finalizando…" : "Finalizar inventario"}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5">
              <p className="text-lg font-semibold">Generar acta de entrega</p>
              <p className="mt-1 text-sm text-slate-500">Requiere el inventario finalizado. Se envía por correo a ambas partes.</p>
              <label className="mt-3 block text-sm text-slate-600">Fecha de entrega
                <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <textarea value={actObservations} onChange={(e) => setActObservations(e.target.value)} rows={2} placeholder="Observaciones del acta (opcional)" className="mt-3 w-full rounded-2xl border-2 border-slate-200 p-3 text-sm outline-none focus:border-[#5646E5]" />
              <button onClick={() => void generateAct()} disabled={busy} className="mt-3 rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50">
                {busy ? "Generando…" : "Generar acta de entrega →"}
              </button>
            </div>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-3xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-6 text-emerald-800">
            <p className="text-lg font-bold">¡Listo! {actDone ? "Acta de entrega generada ✓" : "Inventario completado ✓"}</p>
            <p className="mt-1 text-sm">Se envió por correo a ambas partes y quedó como anexo del contrato.</p>
            <Link href={`/nuevo/gestionar/${id}`} className="mt-4 inline-block rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white">Volver a Gestionar</Link>
          </motion.div>
        )}

        {msg && <p className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">{msg}</p>}
      </div>
    </div>
  );
}
