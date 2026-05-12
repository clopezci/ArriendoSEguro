"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { GUIDED_ITEMS_BY_ZONE, GUIDED_ZONE_OPTIONS } from "@/domain/inventory/inventoryRules";
import type { InventorySelectedZone, InventoryZoneDetail, InventoryZoneItem } from "@/domain/inventory/types";
import { auditEvent } from "@/features/contracts/audit";

type UIMeter = { id?: string; meterType: "water" | "electricity" | "gas" | "other"; meterNumber: string; readingValue: string; photoUrl?: string };
type UIKey = { id?: string; keyType: string; quantity: number; notes: string };

export default function InventoryNewPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
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
      if (!inventoryId) return;
      const res = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(inventoryId)}`);
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
  }, [inventoryId]);

  async function ensureInventory() {
    if (inventoryId) return inventoryId;
    const res = await fetch("/api/inventory/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
      const detailRes = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(invId)}`);
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
      const itemRes = await fetch("/api/inventory/save-zone-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inventoryId,
          selectedZoneId: zone.id,
          items: zoneItems[zone.id] ?? [],
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
      const detailRes = await fetch(`/api/inventory/detail?inventoryId=${encodeURIComponent(inventoryId)}`);
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

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-300">Cargando...</p>;

  return (
    <WizardShell title="Crea el inventario inicial del inmueble" currentStep={10} contractId={id}>
      {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}
      {ok && <p className="mb-3 text-sm text-emerald-300">{ok}</p>}
      <p className="text-sm text-slate-300">
        Selecciona las zonas que quieres inventariar. Luego te guiaremos paso a paso para registrar
        fotos, estado y observaciones de cada espacio.
      </p>

      {!inventoryId || currentStep < 0 ? (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {GUIDED_ZONE_OPTIONS.map((zone) => (
              <label key={zone} className="flex items-center gap-2 rounded border border-slate-700 p-2 text-sm">
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
              className="flex-1 rounded border border-slate-700 bg-slate-900 p-2 text-sm"
              placeholder="Agregar zona personalizada"
              value={customZone}
              onChange={(e) => setCustomZone(e.target.value)}
            />
            <button
              type="button"
              className="rounded border border-violet-500 px-3 py-2 text-sm text-violet-200"
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
            className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? "Guardando..." : "Guardar selección y continuar"}
          </button>
        </>
      ) : (
        <>
          {activeZone && (
            <div className="mt-3 rounded border border-slate-700 p-3">
              <p className="text-sm text-violet-300">Paso {progress}: {activeZone.zoneName}</p>
              <p className="mt-1 text-xs text-slate-400">
                Ahora registra la {activeZone.zoneName.toLowerCase()}. Puedes guardar avance y volver después.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-300">
                  Estado general
                  <select
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
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
                <label className="text-xs text-slate-300">
                  Limpieza
                  <select
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
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
              <label className="mt-2 block text-xs text-slate-300">
                Observaciones
                <textarea
                  className="mt-1 min-h-20 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
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
              <label className="mt-2 block text-xs text-slate-300">
                Daños visibles
                <textarea
                  className="mt-1 min-h-20 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
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
              <label className="mt-2 block text-xs text-slate-300">
                Recomendaciones
                <textarea
                  className="mt-1 min-h-20 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
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
              <label className="mt-2 block text-xs text-slate-300">
                URLs de fotos (separadas por coma) - placeholder mientras se conecta storage
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
                  value={(zoneDetails[activeZone.id]?.photoUrls ?? []).join(", ")}
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
                        photoUrls: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                />
              </label>

              <h4 className="mt-4 text-sm font-semibold text-slate-100">Elementos relevantes</h4>
              <p className="text-xs text-slate-400">
                Puedes agregar y editar elementos de esta zona. Sugeridos para {activeZone.zoneName}.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(GUIDED_ITEMS_BY_ZONE[activeZone.zoneName] ?? []).map((it) => (
                  <button
                    key={it}
                    type="button"
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
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
              </div>
              <div className="mt-2 space-y-2">
                {(zoneItems[activeZone.id] ?? []).map((item, idx) => (
                  <div key={`${item.itemName}-${idx}`} className="grid gap-2 rounded border border-slate-700 p-2 md:grid-cols-4">
                    <input
                      className="rounded border border-slate-700 bg-slate-900 p-1 text-xs"
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
                      className="rounded border border-slate-700 bg-slate-900 p-1 text-xs"
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
                      className="rounded border border-slate-700 bg-slate-900 p-1 text-xs"
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
                      className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-200"
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
                <button type="button" onClick={() => void saveCurrentZone("prev")} className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-200">Anterior</button>
                <button type="button" onClick={() => void saveCurrentZone("stay")} className="rounded border border-violet-500 px-3 py-2 text-xs text-violet-200">Guardar avance</button>
                <button type="button" onClick={() => void saveCurrentZone("next")} className="rounded border border-sky-600 px-3 py-2 text-xs text-sky-200">Siguiente zona</button>
                <button type="button" onClick={() => void skipCurrentZone()} className="rounded border border-amber-600 px-3 py-2 text-xs text-amber-200">Saltar esta zona</button>
                <button type="button" onClick={() => void completeInventory()} className="rounded bg-violet-600 px-3 py-2 text-xs text-white">Finalizar inventario</button>
              </div>
            </div>
          )}
        </>
      )}

      {inventoryReportHtml && (
        <div className="mt-5 rounded border border-slate-700 p-3">
          <h3 className="text-sm font-semibold text-slate-100">Resumen del inventario</h3>
          <p className="text-xs text-slate-400">
            Zonas seleccionadas: {selectedZoneRows.length} | completadas:{" "}
            {selectedZoneRows.filter((z) => z.status === "completed").length} | omitidas:{" "}
            {selectedZoneRows.filter((z) => z.status === "skipped").length}
          </p>
          <p className="text-xs text-slate-400">
            Fotos:{" "}
            {Object.values(zoneDetails).reduce((a, d) => a + (d.photoUrls?.length ?? 0), 0) +
              Object.values(zoneItems).flat().reduce((a, i) => a + (i.photoUrls?.length ?? 0), 0)}
          </p>
          <p className="text-xs text-slate-400">Hash: {inventoryReportHash}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generatePdf()}
              disabled={saving}
              className="rounded border border-emerald-600 px-3 py-2 text-xs text-emerald-200"
            >
              Descargar PDF
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/contracts/${id}/inventory/preview?inventoryId=${encodeURIComponent(inventoryId)}`)
              }
              className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-200"
            >
              Generar reporte / ver reporte
            </button>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/contracts/${id}/preview`)}
              className="rounded border border-violet-500 px-3 py-2 text-xs text-violet-200"
            >
              Asociar al contrato
            </button>
            {inventoryPdfUrl && (
              <a
                href={inventoryPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-emerald-500 px-3 py-2 text-xs text-emerald-200"
              >
                Abrir PDF generado
              </a>
            )}
          </div>
        </div>
      )}

      {inventoryId && (
        <div className="mt-5 rounded border border-slate-700 p-3">
          <h3 className="text-sm font-semibold text-slate-100">Medidores registrados</h3>
          <button type="button" onClick={() => setMeters((prev) => [...prev, { meterType: "water", meterNumber: "", readingValue: "" }])} className="mt-2 rounded border border-sky-600 px-3 py-2 text-xs text-sky-200">Agregar medidor</button>
          <div className="mt-2 space-y-2">
            {meters.map((m, idx) => (
              <div key={idx} className="grid gap-2 rounded border border-slate-700 p-2 md:grid-cols-4">
                <select className="rounded border border-slate-700 bg-slate-900 p-1 text-xs" value={m.meterType} onChange={(e) => setMeters((prev) => prev.map((x, j) => (j === idx ? { ...x, meterType: e.target.value as UIMeter["meterType"] } : x)))}>
                  <option value="water">Agua</option><option value="electricity">Energía</option><option value="gas">Gas</option><option value="other">Otro</option>
                </select>
                <input className="rounded border border-slate-700 bg-slate-900 p-1 text-xs" placeholder="Número de medidor" value={m.meterNumber} onChange={(e) => setMeters((prev) => prev.map((x, j) => (j === idx ? { ...x, meterNumber: e.target.value } : x)))} />
                <input className="rounded border border-slate-700 bg-slate-900 p-1 text-xs" placeholder="Lectura inicial" value={m.readingValue} onChange={(e) => setMeters((prev) => prev.map((x, j) => (j === idx ? { ...x, readingValue: e.target.value } : x)))} />
                <button type="button" onClick={() => setMeters((prev) => prev.filter((_, j) => j !== idx))} className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-200">Eliminar</button>
              </div>
            ))}
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-100">Llaves y controles</h3>
          <button type="button" onClick={() => setKeys((prev) => [...prev, { keyType: "llave puerta principal", quantity: 1, notes: "" }])} className="mt-2 rounded border border-sky-600 px-3 py-2 text-xs text-sky-200">Agregar llave/control</button>
          <div className="mt-2 space-y-2">
            {keys.map((k, idx) => (
              <div key={idx} className="grid gap-2 rounded border border-slate-700 p-2 md:grid-cols-4">
                <input className="rounded border border-slate-700 bg-slate-900 p-1 text-xs" value={k.keyType} onChange={(e) => setKeys((prev) => prev.map((x, j) => (j === idx ? { ...x, keyType: e.target.value } : x)))} />
                <input type="number" className="rounded border border-slate-700 bg-slate-900 p-1 text-xs" value={k.quantity} onChange={(e) => setKeys((prev) => prev.map((x, j) => (j === idx ? { ...x, quantity: Number(e.target.value || 1) } : x)))} />
                <input className="rounded border border-slate-700 bg-slate-900 p-1 text-xs" placeholder="Observaciones" value={k.notes} onChange={(e) => setKeys((prev) => prev.map((x, j) => (j === idx ? { ...x, notes: e.target.value } : x)))} />
                <button type="button" onClick={() => setKeys((prev) => prev.filter((_, j) => j !== idx))} className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-200">Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        TODO: inventario final se implementará en el módulo de cierre del contrato.
      </p>
    </WizardShell>
  );
}

