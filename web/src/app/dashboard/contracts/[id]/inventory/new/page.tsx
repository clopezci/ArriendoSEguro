"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { InventoryZonePhotos } from "@/components/contracts/inventory-zone-photos";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import {
  FALLBACK_GUIDED_ITEMS,
  GUIDED_ITEMS_BY_ZONE,
  GUIDED_ZONE_OPTIONS,
} from "@/domain/inventory/inventoryRules";
import type { InventorySelectedZone, InventoryZoneDetail, InventoryZoneItem } from "@/domain/inventory/types";
import { auditEvent } from "@/features/contracts/audit";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type UIMeter = { id?: string; meterType: "water" | "electricity" | "gas" | "other"; meterNumber: string; readingValue: string; photoUrl?: string };
type UIKey = { id?: string; keyType: string; quantity: number; notes: string };

export default function InventoryNewPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const { user } = useAuth();
  const qs = useSearchParams();
  const router = useRouter();
  const initialInventoryId = qs.get("inventoryId") ?? "";
  const contractVersionId = qs.get("contractVersionId") ?? "";
  const [inventoryId, setInventoryId] = useState(initialInventoryId);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [customZone, setCustomZone] = useState("");
  const [selectedZoneRows, setSelectedZoneRows] = useState<InventorySelectedZone[]>([]);
  const [zoneDetails, setZoneDetails] = useState<Record<string, InventoryZoneDetail>>({});
  const [zoneItems, setZoneItems] = useState<Record<string, InventoryZoneItem[]>>({});
  const [currentStep, setCurrentStep] = useState(-1);
  const [inventoryReportHtml, setInventoryReportHtml] = useState("");
  const [inventoryReportHash, setInventoryReportHash] = useState("");
  const [inventoryPdfUrl, setInventoryPdfUrl] = useState("");
  const [meters, setMeters] = useState<UIMeter[]>([]);
  const [keys, setKeys] = useState<UIKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!inventoryId || !user) return;
      const res = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(inventoryId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const zones = (data.selectedZones ?? []) as InventorySelectedZone[];
        setSelectedZoneRows(zones.sort((a, b) => a.order - b.order));
        setSelectedZones(zones.map((z) => z.zoneName));
        const details = (data.zoneDetails ?? []) as InventoryZoneDetail[];
        const detailsMap: Record<string, InventoryZoneDetail> = {};
        details.forEach((d) => {
          detailsMap[d.selectedZoneId] = d;
        });
        setZoneDetails(detailsMap);
        const zItems = (data.zoneItems ?? []) as InventoryZoneItem[];
        const itemsMap: Record<string, InventoryZoneItem[]> = {};
        zItems.forEach((i) => {
          itemsMap[i.selectedZoneId] = [...(itemsMap[i.selectedZoneId] ?? []), i];
        });
        setZoneItems(itemsMap);
        setInventoryReportHtml(data.inventory?.generatedHtml ?? "");
        setInventoryReportHash(data.inventory?.documentHash ?? "");
        setInventoryPdfUrl(data.inventory?.generatedPdfUrl ?? "");
        setMeters((data.meterReadings ?? []) as UIMeter[]);
        setKeys((data.keys ?? []) as UIKey[]);
      }
    };
    void load();
  }, [inventoryId, user]);

  async function ensureInventory() {
    if (inventoryId) return inventoryId;
    const res = await fetch("/api/inventory/create", {
      method: "POST",
      headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
      body: JSON.stringify({
        leaseProcessId: id,
        contractId: id,
        contractVersionId,
        inventoryType: "initial",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo crear inventario.");
    setInventoryId(data.inventoryId);
    return data.inventoryId as string;
  }

  async function saveZoneSelection() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const invId = await ensureInventory();
      const zones = [
        ...selectedZones.map((z, idx) => ({
          zoneCode: z.toLowerCase().replaceAll(" ", "_"),
          zoneName: z,
          order: idx,
        })),
      ];
      const res = await fetch("/api/inventory/select-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId: invId, zones }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo guardar.");
      const detailRes = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(invId)}`, {
        headers: { ...(user ? await buildAuthHeaders(user) : {}) },
      });
      const detail = await detailRes.json();
      const rows = (detail?.selectedZones ?? []) as InventorySelectedZone[];
      setSelectedZoneRows(rows.sort((a, b) => a.order - b.order));
      setCurrentStep(0);
      setOk("Selección de zonas guardada. Ahora iniciaremos paso a paso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar inventario.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCurrentZone(nextAction: "next" | "prev" | "stay") {
    if (currentStep < 0 || currentStep >= selectedZoneRows.length) return;
    setSaving(true);
    setError("");
    setOk("");
    try {
      const zone = selectedZoneRows[currentStep];
      if (!zone) return;
      const detail =
        zoneDetails[zone.id] ??
        ({
          id: "",
          inventoryId,
          selectedZoneId: zone.id,
          generalCondition: "Bueno",
          cleanlinessStatus: "Limpio",
          observations: "",
          damageDescription: "",
          recommendations: "",
          photoUrls: [],
          createdAt: "",
          updatedAt: "",
        } as InventoryZoneDetail);
      const res = await fetch("/api/inventory/save-zone-detail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inventoryId,
          selectedZoneId: zone.id,
          generalCondition: detail.generalCondition,
          cleanlinessStatus: detail.cleanlinessStatus,
          observations: detail.observations,
          damageDescription: detail.damageDescription,
          recommendations: detail.recommendations,
          photoUrls: detail.photoUrls,
          status: "completed",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo guardar zona.");
      // Filtramos los elementos vacíos (los que el usuario agregó pero no
      // alcanzó a nombrar). Así el guardado funciona aunque el usuario haya
      // dejado todo en blanco: los elementos no son obligatorios.
      const itemsToPersist = (zoneItems[zone.id] ?? [])
        .map((item) => ({
          ...item,
          itemName: (item.itemName ?? "").trim(),
        }))
        .filter((item) => item.itemName.length > 0);
      const itemRes = await fetch("/api/inventory/save-zone-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inventoryId,
          selectedZoneId: zone.id,
          items: itemsToPersist,
        }),
      });
      const itemData = await itemRes.json();
      if (!itemRes.ok || !itemData.success) throw new Error(itemData?.errors?.[0]?.message ?? "No se pudieron guardar elementos.");
      await fetch("/api/inventory/save-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId, items: [], meterReadings: meters, keys }),
      });
      if (nextAction === "next") setCurrentStep((s) => Math.min(s + 1, selectedZoneRows.length - 1));
      if (nextAction === "prev") setCurrentStep((s) => Math.max(s - 1, 0));
      setOk("Zona guardada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar zona.");
    } finally {
      setSaving(false);
    }
  }

  async function skipCurrentZone() {
    if (currentStep < 0 || currentStep >= selectedZoneRows.length) return;
    const zone = selectedZoneRows[currentStep];
    if (!zone) return;
    setSaving(true);
    setError("");
    try {
      await fetch("/api/inventory/save-zone-detail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inventoryId,
          selectedZoneId: zone.id,
          generalCondition: "No aplica",
          cleanlinessStatus: "No aplica",
          observations: "",
          damageDescription: "",
          recommendations: "",
          photoUrls: [],
          status: "skipped",
          skipReason: "No aplica para este inmueble",
        }),
      });
      setCurrentStep((s) => Math.min(s + 1, selectedZoneRows.length - 1));
      setOk("Zona omitida.");
    } finally {
      setSaving(false);
    }
  }

  async function completeInventory() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/inventory/complete-guided", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data?.errors?.[0]?.message ?? "No se pudo completar inventario.");
      setOk("Inventario guiado completado.");
      const detailRes = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(inventoryId)}`, {
        headers: { ...(user ? await buildAuthHeaders(user) : {}) },
      });
      const detail = await detailRes.json();
      setInventoryReportHtml(detail?.inventory?.generatedHtml ?? "");
      setInventoryReportHash(detail?.inventory?.documentHash ?? "");
      await fetch("/api/inventory/save-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId, items: [], meterReadings: meters, keys }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al completar inventario.");
    } finally {
      setSaving(false);
    }
  }

  async function generatePdf() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/inventory/generate-report-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inventoryId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data?.errors?.[0]?.message ?? "No se pudo generar PDF.");
      setInventoryPdfUrl(data.pdfUrl ?? "");
      setOk("Reporte PDF generado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar PDF.");
    } finally {
      setSaving(false);
    }
  }

  const activeZone = currentStep >= 0 ? selectedZoneRows[currentStep] : null;
  const progress = activeZone ? `${currentStep + 1} de ${selectedZoneRows.length}` : "";

  useEffect(() => {
    if (!activeZone || !inventoryId) return;
    auditEvent("inventory_zone_started", {
      inventoryId,
      selectedZoneId: activeZone.id,
      zoneName: activeZone.zoneName,
      step: currentStep + 1,
    });
  }, [activeZone, currentStep, inventoryId]);

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-700">Cargando...</p>;

  return (
    <WizardShell title="Crea el inventario inicial del inmueble" currentStep={11} contractId={id} variant="extra" macroStep="acta">
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      {ok && <p className="mb-3 text-sm text-emerald-700">{ok}</p>}
      <p className="text-sm text-slate-700">
        Selecciona las zonas que quieres inventariar. Luego te guiaremos paso a paso para registrar
        fotos, estado y observaciones de cada espacio.
      </p>

      {!inventoryId || currentStep < 0 ? (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {GUIDED_ZONE_OPTIONS.map((zone) => (
              <label key={zone} className="flex items-center gap-2 rounded border border-slate-300 p-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedZones.includes(zone)}
                  onChange={(e) => {
                    setSelectedZones((prev) =>
                      e.target.checked ? [...prev, zone] : prev.filter((z) => z !== zone),
                    );
                  }}
                />
                {zone}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded border border-slate-300 bg-white p-2 text-sm"
              placeholder="Agregar zona personalizada"
              value={customZone}
              onChange={(e) => setCustomZone(e.target.value)}
            />
            <button
              type="button"
              className="rounded border border-violet-500 px-3 py-2 text-sm text-violet-700"
              onClick={() => {
                const v = customZone.trim();
                if (!v) return;
                if (!selectedZones.includes(v)) setSelectedZones((prev) => [...prev, v]);
                setCustomZone("");
              }}
            >
              Agregar
            </button>
          </div>
          <button
            type="button"
            onClick={saveZoneSelection}
            disabled={saving || selectedZones.length === 0}
            className="mt-4 rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? "Guardando..." : "Guardar selección y continuar"}
          </button>
        </>
      ) : (
        <>
          {activeZone && (
            <div className="mt-3 rounded border border-slate-300 p-3">
              <p className="text-sm text-violet-700">Paso {progress}: {activeZone.zoneName}</p>
              <p className="mt-1 text-xs text-slate-600">
                Ahora registra la {activeZone.zoneName.toLowerCase()}. Puedes guardar avance y volver después.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-700">
                  Estado general
                  <select
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm"
                    value={zoneDetails[activeZone.id]?.generalCondition ?? "Bueno"}
                    onChange={(e) =>
                      setZoneDetails((prev) => ({
                        ...prev,
                        [activeZone.id]: {
                          ...(prev[activeZone.id] ??
                            ({
                              id: "",
                              inventoryId,
                              selectedZoneId: activeZone.id,
                              generalCondition: "Bueno",
                              cleanlinessStatus: "Limpio",
                              observations: "",
                              damageDescription: "",
                              recommendations: "",
                              photoUrls: [],
                              createdAt: "",
                              updatedAt: "",
                            } as InventoryZoneDetail)),
                          generalCondition: e.target.value as InventoryZoneDetail["generalCondition"],
                        },
                      }))
                    }
                  >
                    <option>Excelente</option><option>Bueno</option><option>Aceptable</option><option>Regular</option><option>Malo</option><option>No aplica</option>
                  </select>
                </label>
                <label className="text-xs text-slate-700">
                  Limpieza
                  <select
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm"
                    value={zoneDetails[activeZone.id]?.cleanlinessStatus ?? "Limpio"}
                    onChange={(e) =>
                      setZoneDetails((prev) => ({
                        ...prev,
                        [activeZone.id]: {
                          ...(prev[activeZone.id] ??
                            ({
                              id: "",
                              inventoryId,
                              selectedZoneId: activeZone.id,
                              generalCondition: "Bueno",
                              cleanlinessStatus: "Limpio",
                              observations: "",
                              damageDescription: "",
                              recommendations: "",
                              photoUrls: [],
                              createdAt: "",
                              updatedAt: "",
                            } as InventoryZoneDetail)),
                          cleanlinessStatus: e.target.value as InventoryZoneDetail["cleanlinessStatus"],
                        },
                      }))
                    }
                  >
                    <option>Limpio</option><option>Aceptable</option><option>Sucio</option><option>No aplica</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-xs text-slate-700">
                Observaciones
                <textarea
                  className="mt-1 min-h-20 w-full rounded border border-slate-300 bg-white p-2 text-sm"
                  value={zoneDetails[activeZone.id]?.observations ?? ""}
                  onChange={(e) =>
                    setZoneDetails((prev) => ({
                      ...prev,
                      [activeZone.id]: {
                        ...(prev[activeZone.id] ??
                          ({
                            id: "",
                            inventoryId,
                            selectedZoneId: activeZone.id,
                            generalCondition: "Bueno",
                            cleanlinessStatus: "Limpio",
                            observations: "",
                            damageDescription: "",
                            recommendations: "",
                            photoUrls: [],
                            createdAt: "",
                            updatedAt: "",
                          } as InventoryZoneDetail)),
                        observations: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="mt-2 block text-xs text-slate-700">
                Daños visibles
                <textarea
                  className="mt-1 min-h-20 w-full rounded border border-slate-300 bg-white p-2 text-sm"
                  value={zoneDetails[activeZone.id]?.damageDescription ?? ""}
                  onChange={(e) =>
                    setZoneDetails((prev) => ({
                      ...prev,
                      [activeZone.id]: {
                        ...(prev[activeZone.id] ??
                          ({
                            id: "",
                            inventoryId,
                            selectedZoneId: activeZone.id,
                            generalCondition: "Bueno",
                            cleanlinessStatus: "Limpio",
                            observations: "",
                            damageDescription: "",
                            recommendations: "",
                            photoUrls: [],
                            createdAt: "",
                            updatedAt: "",
                          } as InventoryZoneDetail)),
                        damageDescription: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="mt-2 block text-xs text-slate-700">
                Recomendaciones
                <textarea
                  className="mt-1 min-h-20 w-full rounded border border-slate-300 bg-white p-2 text-sm"
                  value={zoneDetails[activeZone.id]?.recommendations ?? ""}
                  onChange={(e) =>
                    setZoneDetails((prev) => ({
                      ...prev,
                      [activeZone.id]: {
                        ...(prev[activeZone.id] ??
                          ({
                            id: "",
                            inventoryId,
                            selectedZoneId: activeZone.id,
                            generalCondition: "Bueno",
                            cleanlinessStatus: "Limpio",
                            observations: "",
                            damageDescription: "",
                            recommendations: "",
                            photoUrls: [],
                            createdAt: "",
                            updatedAt: "",
                          } as InventoryZoneDetail)),
                        recommendations: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <InventoryZonePhotos
                inventoryId={inventoryId}
                zoneId={activeZone.id}
                photoUrls={zoneDetails[activeZone.id]?.photoUrls ?? []}
                onChange={(next) =>
                  setZoneDetails((prev) => ({
                    ...prev,
                    [activeZone.id]: {
                      ...(prev[activeZone.id] ??
                        ({
                          id: "",
                          inventoryId,
                          selectedZoneId: activeZone.id,
                          generalCondition: "Bueno",
                          cleanlinessStatus: "Limpio",
                          observations: "",
                          damageDescription: "",
                          recommendations: "",
                          photoUrls: [],
                          createdAt: "",
                          updatedAt: "",
                        } as InventoryZoneDetail)),
                      photoUrls: next,
                    },
                  }))
                }
              />

              <h4 className="mt-4 text-sm font-semibold text-slate-900">Elementos relevantes (opcional)</h4>
              <p className="text-xs text-slate-600">
                Si quieres dejar mayor detalle, agrega elementos puntuales de esta zona. Es opcional:
                puedes guardar la zona sin elementos y avanzar.
              </p>
              {(() => {
                const suggested =
                  GUIDED_ITEMS_BY_ZONE[activeZone.zoneName] ?? FALLBACK_GUIDED_ITEMS;
                return (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggested.map((it) => (
                      <button
                        key={it}
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        onClick={() => {
                          setZoneItems((prev) => ({
                            ...prev,
                            [activeZone.id]: [
                              ...(prev[activeZone.id] ?? []),
                              {
                                id: "",
                                inventoryId,
                                selectedZoneId: activeZone.id,
                                itemName: it,
                                conditionStatus: "good",
                                notes: "",
                                photoUrls: [],
                                createdAt: "",
                                updatedAt: "",
                              },
                            ],
                          }));
                        }}
                      >
                        + {it}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rounded border border-violet-500 px-2 py-1 text-xs text-violet-700"
                      onClick={() => {
                        setZoneItems((prev) => ({
                          ...prev,
                          [activeZone.id]: [
                            ...(prev[activeZone.id] ?? []),
                            {
                              id: "",
                              inventoryId,
                              selectedZoneId: activeZone.id,
                              itemName: "",
                              conditionStatus: "good",
                              notes: "",
                              photoUrls: [],
                              createdAt: "",
                              updatedAt: "",
                            },
                          ],
                        }));
                      }}
                    >
                      + Elemento personalizado
                    </button>
                  </div>
                );
              })()}
              <div className="mt-2 space-y-2">
                {(zoneItems[activeZone.id] ?? []).map((item, idx) => (
                  <div key={`${item.itemName}-${idx}`} className="grid gap-2 rounded border border-slate-300 p-2 md:grid-cols-4">
                    <input
                      className="rounded border border-slate-300 bg-white p-1 text-xs"
                      value={item.itemName}
                      onChange={(e) =>
                        setZoneItems((prev) => ({
                          ...prev,
                          [activeZone.id]: (prev[activeZone.id] ?? []).map((x, j) =>
                            j === idx ? { ...x, itemName: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                    <select
                      className="rounded border border-slate-300 bg-white p-1 text-xs"
                      value={item.conditionStatus}
                      onChange={(e) =>
                        setZoneItems((prev) => ({
                          ...prev,
                          [activeZone.id]: (prev[activeZone.id] ?? []).map((x, j) =>
                            j === idx
                              ? {
                                  ...x,
                                  conditionStatus: e.target.value as InventoryZoneItem["conditionStatus"],
                                }
                              : x,
                          ),
                        }))
                      }
                    >
                      <option value="excellent">Excelente</option>
                      <option value="good">Bueno</option>
                      <option value="fair">Aceptable</option>
                      <option value="poor">Regular</option>
                      <option value="damaged">Malo</option>
                      <option value="not_applicable">No aplica</option>
                    </select>
                    <input
                      className="rounded border border-slate-300 bg-white p-1 text-xs"
                      placeholder="Notas"
                      value={item.notes}
                      onChange={(e) =>
                        setZoneItems((prev) => ({
                          ...prev,
                          [activeZone.id]: (prev[activeZone.id] ?? []).map((x, j) =>
                            j === idx ? { ...x, notes: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-700"
                      onClick={() =>
                        setZoneItems((prev) => ({
                          ...prev,
                          [activeZone.id]: (prev[activeZone.id] ?? []).filter((_, j) => j !== idx),
                        }))
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveCurrentZone("prev")}
                  disabled={saving || currentStep === 0}
                  className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ← Zona anterior
                </button>
                <button
                  type="button"
                  onClick={() => void saveCurrentZone("stay")}
                  disabled={saving}
                  className="rounded border border-violet-500 px-3 py-2 text-xs text-violet-700 disabled:opacity-50"
                >
                  Guardar avance
                </button>
                {currentStep < selectedZoneRows.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => void saveCurrentZone("next")}
                    disabled={saving}
                    className="rounded border border-sky-500 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 disabled:opacity-50"
                  >
                    Guardar y continuar a la siguiente zona →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void completeInventory()}
                    disabled={saving}
                    className="rounded bg-[#5646E5] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Guardar y finalizar inventario
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void skipCurrentZone()}
                  disabled={saving}
                  className="rounded border border-amber-600 px-3 py-2 text-xs text-amber-800 disabled:opacity-50"
                >
                  Saltar esta zona
                </button>
                {currentStep < selectedZoneRows.length - 1 && (
                  <button
                    type="button"
                    onClick={() => void completeInventory()}
                    disabled={saving}
                    className="rounded border border-violet-500 px-3 py-2 text-xs text-violet-700 disabled:opacity-50"
                  >
                    Finalizar ahora (las pendientes quedan abiertas)
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedZoneRows.length > 0 && (
            <div className="mt-4 rounded border border-slate-300 bg-white/70 p-3">
              <p className="text-xs font-semibold text-slate-700">
                Zonas seleccionadas ({selectedZoneRows.length})
              </p>
              <ul className="mt-1 grid gap-1 text-xs text-slate-700 md:grid-cols-2">
                {selectedZoneRows.map((zone, idx) => {
                  const isActive = idx === currentStep;
                  const status = zone.status;
                  const dot =
                    status === "completed"
                      ? "bg-emerald-500"
                      : status === "skipped"
                        ? "bg-amber-500"
                        : isActive
                          ? "bg-violet-500"
                          : "bg-slate-300";
                  return (
                    <li
                      key={zone.id}
                      className={`flex items-center gap-2 rounded px-2 py-1 ${isActive ? "bg-violet-50" : ""}`}
                    >
                      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                      <button
                        type="button"
                        onClick={() => setCurrentStep(idx)}
                        className="text-left hover:underline"
                      >
                        {idx + 1}. {zone.zoneName}
                        {status === "completed" && (
                          <span className="ml-1 text-[10px] text-emerald-700">(completada)</span>
                        )}
                        {status === "skipped" && (
                          <span className="ml-1 text-[10px] text-amber-700">(omitida)</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[10px] text-slate-500">
                Puedes hacer clic en una zona para volver a editarla.
              </p>
            </div>
          )}
        </>
      )}

      {inventoryReportHtml && (
        <div className="mt-5 rounded-2xl border border-emerald-400 bg-emerald-50 p-4">
          <h3 className="text-sm font-semibold text-emerald-900">
            Inventario inicial generado correctamente
          </h3>
          <p className="mt-1 text-xs text-emerald-800">
            Zonas seleccionadas: {selectedZoneRows.length} | completadas:{" "}
            {selectedZoneRows.filter((z) => z.status === "completed").length} | omitidas:{" "}
            {selectedZoneRows.filter((z) => z.status === "skipped").length}
          </p>
          <p className="text-xs text-emerald-800">
            Fotos:{" "}
            {Object.values(zoneDetails).reduce((a, d) => a + (d.photoUrls?.length ?? 0), 0) +
              Object.values(zoneItems).flat().reduce((a, i) => a + (i.photoUrls?.length ?? 0), 0)}
          </p>
          <p className="text-[10px] text-emerald-800/70">Hash: {inventoryReportHash}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/contracts/${id}/adicionales`)}
              className="rounded-xl bg-[#5646E5] px-4 py-2 text-xs font-medium text-white"
            >
              Regresar a la posventa
            </button>
            <button
              type="button"
              onClick={() => void generatePdf()}
              disabled={saving}
              className="rounded border border-emerald-700 px-3 py-2 text-xs text-emerald-800 disabled:opacity-50"
            >
              Descargar PDF
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/contracts/${id}/inventory/preview?inventoryId=${encodeURIComponent(inventoryId)}`)
              }
              className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-800"
            >
              Ver reporte
            </button>
            {inventoryPdfUrl && (
              <a
                href={inventoryPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-emerald-700 px-3 py-2 text-xs text-emerald-800"
              >
                Abrir PDF generado
              </a>
            )}
          </div>
        </div>
      )}

      {/*
        Botón persistente para regresar al expediente del contrato sin
        importar en qué momento del inventario se encuentre el usuario.
        Antes el usuario reportaba que no veía un botón claro para salir
        del paso 2 del inventario; con esto siempre tiene cómo volver.
      */}
      <div className="mt-6 border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/contracts/${id}/adicionales`)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs text-slate-800 hover:border-violet-500"
        >
          ← Regresar a la posventa
        </button>
      </div>

      {inventoryId && (
        <div className="mt-5 rounded border border-slate-300 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Medidores registrados</h3>
          <button type="button" onClick={() => setMeters((prev) => [...prev, { meterType: "water", meterNumber: "", readingValue: "" }])} className="mt-2 rounded border border-sky-500 px-3 py-2 text-xs text-sky-800">Agregar medidor</button>
          <div className="mt-2 space-y-2">
            {meters.map((m, idx) => (
              <div key={idx} className="grid gap-2 rounded border border-slate-300 p-2 md:grid-cols-4">
                <select className="rounded border border-slate-300 bg-white p-1 text-xs" value={m.meterType} onChange={(e) => setMeters((prev) => prev.map((x, j) => (j === idx ? { ...x, meterType: e.target.value as UIMeter["meterType"] } : x)))}>
                  <option value="water">Agua</option><option value="electricity">Energía</option><option value="gas">Gas</option><option value="other">Otro</option>
                </select>
                <input className="rounded border border-slate-300 bg-white p-1 text-xs" placeholder="Número de medidor" value={m.meterNumber} onChange={(e) => setMeters((prev) => prev.map((x, j) => (j === idx ? { ...x, meterNumber: e.target.value } : x)))} />
                <input className="rounded border border-slate-300 bg-white p-1 text-xs" placeholder="Lectura inicial" value={m.readingValue} onChange={(e) => setMeters((prev) => prev.map((x, j) => (j === idx ? { ...x, readingValue: e.target.value } : x)))} />
                <button type="button" onClick={() => setMeters((prev) => prev.filter((_, j) => j !== idx))} className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-700">Eliminar</button>
              </div>
            ))}
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">Llaves y controles</h3>
          <button type="button" onClick={() => setKeys((prev) => [...prev, { keyType: "llave puerta principal", quantity: 1, notes: "" }])} className="mt-2 rounded border border-sky-500 px-3 py-2 text-xs text-sky-800">Agregar llave/control</button>
          <div className="mt-2 space-y-2">
            {keys.map((k, idx) => (
              <div key={idx} className="grid gap-2 rounded border border-slate-300 p-2 md:grid-cols-4">
                <input className="rounded border border-slate-300 bg-white p-1 text-xs" value={k.keyType} onChange={(e) => setKeys((prev) => prev.map((x, j) => (j === idx ? { ...x, keyType: e.target.value } : x)))} />
                <input type="number" className="rounded border border-slate-300 bg-white p-1 text-xs" value={k.quantity} onChange={(e) => setKeys((prev) => prev.map((x, j) => (j === idx ? { ...x, quantity: Number(e.target.value || 1) } : x)))} />
                <input className="rounded border border-slate-300 bg-white p-1 text-xs" placeholder="Observaciones" value={k.notes} onChange={(e) => setKeys((prev) => prev.map((x, j) => (j === idx ? { ...x, notes: e.target.value } : x)))} />
                <button type="button" onClick={() => setKeys((prev) => prev.filter((_, j) => j !== idx))} className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-700">Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-600">
        Este es el inventario de <strong>entrega</strong> del inmueble. El inventario de{" "}
        <strong>devolución</strong> (al terminar el arriendo) se hará más adelante, en el cierre del contrato, para
        comparar el estado y dejar el paz y salvo.
      </p>
    </WizardShell>
  );
}

