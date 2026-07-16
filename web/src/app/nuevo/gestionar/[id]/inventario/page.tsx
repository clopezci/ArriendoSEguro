"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useSavedContract } from "@/components/contracts/requires-saved-contract";
import { InventoryZonePhotos } from "@/components/contracts/inventory-zone-photos";
import { MicButton } from "@/components/nuevo/mic-button";
import { GUIDED_ZONE_OPTIONS, GUIDED_ITEMS_BY_ZONE, FALLBACK_GUIDED_ITEMS } from "@/domain/inventory/inventoryRules";

/**
 * Inventario y acta de entrega en estilo BENTO ("una cosa a la vez").
 * Orden: 1) elegir MODO (guiado o en bloque) · 2) datos del ACTA (fecha, quién
 * recibe) · 3) inventario (guiado zona-por-zona, o en bloque: fotos + notas por
 * voz) · 4) finalizar → genera el acta (Anexo No. 2) y la envía por correo a
 * ambas partes · 5) continuar a "Administra tu arriendo".
 * Reutiliza los MISMOS endpoints (/api/inventory/* y /api/delivery-act/generate).
 */
const CONDITIONS = ["Excelente", "Bueno", "Aceptable", "Regular", "Malo", "No aplica"] as const;
const CLEANLINESS = ["Limpio", "Aceptable", "Sucio", "No aplica"] as const;
const ITEM_CONDITIONS: Array<{ value: string; label: string }> = [
  { value: "excellent", label: "Excelente" },
  { value: "good", label: "Bueno" },
  { value: "fair", label: "Aceptable" },
  { value: "poor", label: "Regular" },
  { value: "damaged", label: "Malo" },
  { value: "not_applicable", label: "No aplica" },
];
const BLOCK_ZONE_NAME = "Inmueble (general)";

type Mode = "guided" | "block";
type Phase = "loading" | "locked" | "intro" | "acta" | "zones" | "fill" | "review" | "block" | "done";
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
  const [mode, setMode] = useState<Mode>("guided");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [inventoryId, setInventoryId] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [zi, setZi] = useState(0);
  const [data, setData] = useState<Record<string, ZoneData>>({});
  // Acta (se pide AL PRINCIPIO)
  const [deliveryDate, setDeliveryDate] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [actObservations, setActObservations] = useState("");
  // Bloque
  const [blockZoneId, setBlockZoneId] = useState("");
  const [blockPhotos, setBlockPhotos] = useState<string[]>([]);
  const [blockNotes, setBlockNotes] = useState("");

  const authHeaders = useCallback(async () => (user ? await buildAuthHeaders(user) : {}), [user]);

  useEffect(() => {
    if (sc.status === "loading") return;
    if (sc.status !== "saved" || !versionId) { setPhase("locked"); return; }
    setPhase("intro");
  }, [sc.status, versionId]);

  /** Crea (o reutiliza) el inventario. Devuelve su id. */
  async function ensureInventory(): Promise<string> {
    const h = { "content-type": "application/json", ...(await authHeaders()) };
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
      if (!r.ok || !j.success || !j.inventoryId) throw new Error(j.errors?.[0]?.message ?? "No se pudo crear el inventario. (Requiere Plan Plus.)");
      invId = j.inventoryId;
    }
    return invId;
  }

  /** Tras elegir modo y datos del acta, arranca el inventario según el modo. */
  async function startInventory() {
    if (!versionId) return;
    setBusy(true); setMsg("");
    try {
      const invId = await ensureInventory();
      setInventoryId(invId);
      if (mode === "guided") {
        setPhase("zones");
      } else {
        // Bloque: una sola "zona" contenedora para colgar fotos + notas.
        const h = { "content-type": "application/json", ...(await authHeaders()) };
        await fetch("/api/inventory/select-zones", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ inventoryId: invId, zones: [{ zoneCode: "inmueble_general", zoneName: BLOCK_ZONE_NAME, order: 0 }] }),
        });
        const dr = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(invId)}`, { headers: h });
        const dj = (await dr.json()) as { selectedZones?: Array<{ id: string; zoneName: string; observations?: string; photoUrls?: string[] }>; zoneDetails?: Array<{ selectedZoneId: string; observations?: string; photoUrls?: string[] }> };
        const z = (dj.selectedZones ?? [])[0];
        if (!z) { setMsg("No se pudo preparar el inventario en bloque."); return; }
        setBlockZoneId(z.id);
        const zd = (dj.zoneDetails ?? []).find((x) => x.selectedZoneId === z.id);
        if (zd) { setBlockNotes(zd.observations ?? ""); setBlockPhotos(Array.isArray(zd.photoUrls) ? zd.photoUrls : []); }
        setPhase("block");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error de red al iniciar el inventario.");
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
      const dr = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(inventoryId)}`, { headers: h });
      const dj = (await dr.json()) as {
        selectedZones?: Array<{ id: string; zoneName: string; status?: string }>;
        zoneDetails?: Array<{ selectedZoneId: string; generalCondition?: string; cleanlinessStatus?: string; observations?: string; photoUrls?: string[] }>;
        zoneItems?: Array<{ selectedZoneId: string; itemName?: string; conditionStatus?: string; notes?: string }>;
      };
      const rows = (dj.selectedZones ?? []).filter((z) => z.status !== "skipped").map((z) => ({ id: z.id, zoneName: z.zoneName }));
      if (rows.length === 0) { setMsg("No se pudieron cargar las zonas."); return; }
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

  /** Guarda la zona-bloque (fotos + notas dictadas) antes de finalizar. */
  async function saveBlockZone(): Promise<boolean> {
    const r = await fetch("/api/inventory/save-zone-detail", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ inventoryId, selectedZoneId: blockZoneId, generalCondition: "No aplica", cleanlinessStatus: "No aplica", observations: blockNotes, photoUrls: blockPhotos, status: "completed" }),
    });
    const j = (await r.json()) as { success?: boolean };
    return r.ok && Boolean(j.success);
  }

  /** Un SOLO paso final: finaliza el inventario, genera el acta y la envía. */
  async function finalizeAndGenerate() {
    setBusy(true); setMsg("");
    try {
      if (mode === "block") {
        if (blockPhotos.length === 0) { setMsg("Agrega al menos una foto del inmueble antes de finalizar."); setBusy(false); return; }
        const ok = await saveBlockZone();
        if (!ok) { setMsg("No se pudo guardar el inventario en bloque."); setBusy(false); return; }
      }
      const rc = await fetch("/api/inventory/complete-guided", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inventoryId }) });
      const jc = (await rc.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!rc.ok || !jc.success) { setMsg(jc.errors?.[0]?.message ?? "No se pudo finalizar el inventario."); setBusy(false); return; }

      const obs = [receiverName.trim() ? `Recibe la entrega: ${receiverName.trim()}.` : "", actObservations.trim()].filter(Boolean).join(" ");
      const ra = await fetch("/api/delivery-act/generate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId, contractId: id, contractVersionId: versionId, observations: obs || undefined, deliveryDate: deliveryDate || undefined }),
      });
      const ja = (await ra.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!ra.ok || !ja.success) { setMsg(ja.errors?.[0]?.message ?? "El inventario quedó, pero no se pudo generar el acta. Reintenta."); setBusy(false); return; }
      setPhase("done");
    } catch {
      setMsg("Error de red al finalizar.");
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
          <Link href={`/nuevo/gestionar/${id}`} className="text-sm font-semibold text-[#5646E5] hover:underline">← Administra tu arriendo</Link>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Inventario y acta</span>
        </div>

        <h1 className="text-balance text-3xl font-extrabold tracking-tight">Inventario y acta de entrega</h1>

        {phase === "loading" && <p className="mt-6 text-slate-400">Cargando…</p>}

        {phase === "locked" && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/70 p-6 text-amber-900">
            <p className="font-bold">Primero guarda el contrato</p>
            <p className="mt-1 text-sm">El inventario y el acta se habilitan cuando el contrato está guardado (Plan Plus). Vuelve a “Administra tu arriendo” y finaliza el contrato.</p>
          </div>
        )}

        {/* 1) Elegir MODO */}
        {phase === "intro" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
            <p className="text-sm text-slate-500">El inventario es la prueba del estado del inmueble al entregarlo. Elige cómo quieres hacerlo:</p>

            <button onClick={() => setMode("guided")} className={`w-full rounded-3xl border-2 p-5 text-left transition ${mode === "guided" ? "border-[#5646E5] bg-[#ECE9FB]/50" : "border-slate-200 bg-white/90 hover:border-[#5646E5]"}`}>
              <p className="flex items-center gap-2 text-lg font-bold">🧭 Inventario guiado {mode === "guided" && <span className="rounded-full bg-[#5646E5] px-2 py-0.5 text-[10px] font-bold text-white">Elegido</span>}</p>
              <p className="mt-1 text-sm text-slate-600">Te llevamos <b>zona por zona</b> (sala, cocina, baños…). En cada una marcas el estado, la limpieza, los elementos y tomas fotos. Más ordenado y detallado; ideal como prueba fuerte.</p>
            </button>

            <button onClick={() => setMode("block")} className={`w-full rounded-3xl border-2 p-5 text-left transition ${mode === "block" ? "border-[#5646E5] bg-[#ECE9FB]/50" : "border-slate-200 bg-white/90 hover:border-[#5646E5]"}`}>
              <p className="flex items-center gap-2 text-lg font-bold">📸 Inventario en bloque {mode === "block" && <span className="rounded-full bg-[#5646E5] px-2 py-0.5 text-[10px] font-bold text-white">Elegido</span>}</p>
              <p className="mt-1 text-sm text-slate-600">Tomas <b>todas las fotos que quieras</b> del inmueble, sin dividir por zonas, y dejas unas <b>notas al final</b> (puedes <b>dictarlas por voz</b>). Más rápido; útil si tienes prisa.</p>
            </button>

            <button onClick={() => setPhase("acta")} className="mt-2 w-full rounded-2xl bg-[#FF6B4A] px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95">
              Continuar →
            </button>
          </motion.div>
        )}

        {/* 2) Datos del ACTA (al principio) */}
        {phase === "acta" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-3xl border border-slate-200 bg-white/90 p-5">
            <p className="text-lg font-semibold">Datos del acta de entrega</p>
            <p className="mt-1 text-sm text-slate-500">Con esto armamos el <b>acta de entrega</b> (Anexo No. 2) que se envía a ambas partes al terminar.</p>

            <label className="mt-4 block text-sm text-slate-700">Fecha de entrega
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="mt-4 block text-sm text-slate-700">¿Quién recibe el inmueble?
              <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Nombre de quien recibe (ej. el inquilino)" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>

            <label className="mt-4 block text-sm text-slate-700">Observaciones del acta (opcional)</label>
            <div className="mt-1 flex items-start gap-2">
              <textarea value={actObservations} onChange={(e) => setActObservations(e.target.value)} rows={2} placeholder="Notas generales de la entrega…" className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 p-3 text-sm outline-none focus:border-[#5646E5]" />
              <MicButton onResult={(t) => setActObservations((v) => (v ? v + " " : "") + t)} label="Dictar observaciones" />
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button onClick={() => setPhase("intro")} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600">← Atrás</button>
              <button onClick={() => void startInventory()} disabled={busy} className="rounded-2xl bg-[#5646E5] px-7 py-3 text-sm font-bold text-white transition hover:brightness-105 active:scale-95 disabled:opacity-50">
                {busy ? "Preparando…" : mode === "guided" ? "Empezar por zonas →" : "Empezar a tomar fotos →"}
              </button>
            </div>
          </motion.div>
        )}

        {/* 3a) GUIADO: zonas */}
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

        {/* 3a) GUIADO: llenar zona */}
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
            <div className="flex items-start gap-2">
              <textarea value={curData.observations} onChange={(e) => setCur({ observations: e.target.value })} rows={3} placeholder="Daños, detalles, elementos entregados…" className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 p-3 text-sm outline-none focus:border-[#5646E5]" />
              <MicButton onResult={(t) => setCur({ observations: (curData.observations ? curData.observations + " " : "") + t })} label="Dictar observaciones" />
            </div>

            <div className="mt-4 rounded-2xl border-2 border-slate-200 bg-white/70 p-3">
              <InventoryZonePhotos inventoryId={inventoryId} zoneId={cur.id} photoUrls={curData.photoUrls} onChange={(next) => setCur({ photoUrls: next })} />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => void saveZoneAndNext()} disabled={busy} className="rounded-2xl bg-[#5646E5] px-7 py-4 text-base font-bold text-white transition hover:brightness-105 active:scale-95 disabled:opacity-50">
                {busy ? "Guardando…" : zi < zones.length - 1 ? "Guardar y siguiente →" : "Guardar y revisar →"}
              </button>
              {zi > 0 && <button onClick={() => setZi(zi - 1)} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-600">← Atrás</button>}
            </div>
          </motion.div>
        )}

        {/* 3b) BLOQUE: fotos libres + notas por voz */}
        {phase === "block" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5">
              <p className="text-lg font-semibold">Fotos del inmueble</p>
              <p className="mt-1 text-sm text-slate-500">Toma todas las que necesites (habitaciones, cocina, baños, daños, medidores…). Cada foto queda guardada como prueba.</p>
              <div className="mt-3">
                <InventoryZonePhotos inventoryId={inventoryId} zoneId={blockZoneId} photoUrls={blockPhotos} onChange={setBlockPhotos} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5">
              <p className="text-lg font-semibold">Notas del inventario</p>
              <p className="mt-1 text-sm text-slate-500">Describe el estado general y lo que quieras dejar por escrito. Puedes <b>dictarlo por voz</b>.</p>
              <div className="mt-2 flex items-start gap-2">
                <textarea value={blockNotes} onChange={(e) => setBlockNotes(e.target.value)} rows={5} placeholder="Ej. El inmueble se entrega limpio, pintado, con 2 juegos de llaves…" className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 p-3 text-sm outline-none focus:border-[#5646E5]" />
                <MicButton onResult={(t) => setBlockNotes((v) => (v ? v + " " : "") + t)} label="Dictar notas" />
              </div>
            </div>

            <button onClick={() => void finalizeAndGenerate()} disabled={busy} className="w-full rounded-2xl bg-[#12B886] px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95 disabled:opacity-50">
              {busy ? "Finalizando…" : "Finalizar y generar acta de entrega →"}
            </button>
          </motion.div>
        )}

        {/* 4) GUIADO: revisar y finalizar (un solo paso hasta el acta) */}
        {phase === "review" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5">
              <p className="text-lg font-semibold">Revisa el inventario</p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                {zones.map((z) => (
                  <li key={z.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span>{z.zoneName}</span>
                    <span className="text-xs text-slate-500">{data[z.id]?.generalCondition || "—"} · {data[z.id]?.cleanlinessStatus || "—"}{(data[z.id]?.photoUrls?.length ?? 0) > 0 ? ` · 📷 ${data[z.id]?.photoUrls.length}` : ""}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-2xl border border-[#5646E5]/20 bg-[#ECE9FB]/50 p-3 text-xs text-slate-600">
                Al finalizar se genera el <b>acta de entrega</b> con la fecha ({deliveryDate || "hoy"}){receiverName ? ` y quien recibe (${receiverName})` : ""} y se envía por correo a ambas partes.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => { setZi(zones.length - 1); setPhase("fill"); }} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600">← Atrás</button>
                <button onClick={() => void finalizeAndGenerate()} disabled={busy} className="rounded-2xl bg-[#12B886] px-6 py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50">
                  {busy ? "Finalizando…" : "Finalizar y generar acta →"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 5) Listo → Administra tu arriendo */}
        {phase === "done" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-3xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-6 text-emerald-800">
            <p className="text-lg font-bold">¡Listo! Acta de entrega generada ✓</p>
            <p className="mt-1 text-sm">El inventario y el acta quedaron como anexos del contrato y se enviaron por correo a ambas partes para su aceptación.</p>
            <Link href={`/nuevo/gestionar/${id}`} className="mt-4 inline-block rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white">Ir a Administra tu arriendo →</Link>
          </motion.div>
        )}

        {msg && <p className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">{msg}</p>}
      </div>
    </div>
  );
}
