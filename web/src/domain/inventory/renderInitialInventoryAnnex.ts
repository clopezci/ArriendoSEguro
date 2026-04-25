import { generateDocumentHash } from "@/domain/contracts/hash";
import type {
  Inventory,
  InventoryItem,
  InventoryKey,
  InventoryMeterReading,
  InventorySelectedZone,
  InventoryZoneDetail,
  InventoryZoneItem,
} from "./types";

function listItems(items: InventoryItem[]): string {
  return items
    .map(
      (i) => `<tr><td>${i.zone}</td><td>${i.itemName}</td><td>${i.conditionStatus}</td><td>${i.cleanlinessStatus}</td><td>${i.notes || "-"}</td></tr>`,
    )
    .join("");
}

function listMeters(readings: InventoryMeterReading[]): string {
  if (readings.length === 0) return "<p>Sin lecturas registradas.</p>";
  return `<ul>${readings
    .map((m) => `<li>${m.meterType}: #${m.meterNumber || "-"} lectura ${m.readingValue || "-"}</li>`)
    .join("")}</ul>`;
}

function listKeys(keys: InventoryKey[]): string {
  if (keys.length === 0) return "<p>Sin llaves registradas.</p>";
  return `<ul>${keys.map((k) => `<li>${k.keyType}: ${k.quantity} (${k.notes || "sin nota"})</li>`).join("")}</ul>`;
}

export function renderInitialInventoryAnnex(input: {
  inventory: Inventory;
  items: InventoryItem[];
  meterReadings: InventoryMeterReading[];
  keys: InventoryKey[];
  selectedZones?: InventorySelectedZone[];
  zoneDetails?: InventoryZoneDetail[];
  zoneItems?: InventoryZoneItem[];
  contractSummary?: {
    propertyAddress?: string;
    landlordName?: string;
    tenantName?: string;
  };
}) {
  const zones = input.selectedZones ?? [];
  const details = input.zoneDetails ?? [];
  const zItems = input.zoneItems ?? [];
  const completedZones = zones.filter((z) => z.status === "completed");
  const skippedZones = zones.filter((z) => z.status === "skipped");
  const photosCount =
    details.reduce((acc, d) => acc + d.photoUrls.length, 0) +
    zItems.reduce((acc, i) => acc + i.photoUrls.length, 0);
  const zonesSummary = zones.length
    ? `<p>Zonas seleccionadas: ${zones.length} | completadas: ${completedZones.length} | omitidas: ${skippedZones.length}</p>`
    : "";
  const zoneCards = zones
    .map((z) => {
      const detail = details.find((d) => d.selectedZoneId === z.id);
      const items = zItems.filter((i) => i.selectedZoneId === z.id);
      const itemsHtml = items.length
        ? `<ul>${items
            .map(
              (i) =>
                `<li>${i.itemName}: ${i.conditionStatus}${i.notes ? ` (${i.notes})` : ""}</li>`,
            )
            .join("")}</ul>`
        : "<p>Sin elementos detallados.</p>";
      return `
        <section>
          <h3>${z.order + 1}. ${z.zoneName}</h3>
          <p>Estado zona: ${detail?.generalCondition ?? "No registrado"} | Limpieza: ${detail?.cleanlinessStatus ?? "No registrado"}</p>
          <p>Daños visibles: ${detail?.damageDescription || "-"}</p>
          <p>Observaciones: ${detail?.observations || "-"}</p>
          <p>Recomendaciones: ${detail?.recommendations || "-"}</p>
          <p>Fotos: ${(detail?.photoUrls.length ?? 0) + items.reduce((a, i) => a + i.photoUrls.length, 0)}</p>
          <div>${itemsHtml}</div>
        </section>
      `;
    })
    .join("");

  const html = `
    <article>
      <h1>Reporte de inventario inicial del inmueble</h1>
      <p>Inventario ID: ${input.inventory.id}</p>
      <p>Contrato: ${input.inventory.contractId}</p>
      <p>Versión contractual: ${input.inventory.contractVersionId}</p>
      <p>Dirección del inmueble: ${input.contractSummary?.propertyAddress ?? "No disponible"}</p>
      <p>Arrendador: ${input.contractSummary?.landlordName ?? "No disponible"}</p>
      <p>Arrendatario: ${input.contractSummary?.tenantName ?? "No disponible"}</p>
      <p>Fecha de generación: ${new Date().toLocaleString("es-CO")}</p>
      ${zonesSummary}
      <p>Número de fotos registradas: ${photosCount}</p>
      ${zoneCards ? `<h2>Detalle por zona</h2>${zoneCards}` : ""}
      <h2>Elementos por zona</h2>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead><tr><th>Zona</th><th>Elemento</th><th>Estado</th><th>Limpieza</th><th>Notas</th></tr></thead>
        <tbody>${listItems(input.items)}</tbody>
      </table>
      <h2>Lecturas de medidores</h2>
      ${listMeters(input.meterReadings)}
      <h2>Llaves entregadas</h2>
      ${listKeys(input.keys)}
      <p>Hash del reporte: ${generateDocumentHash(
        `${input.inventory.id}:${input.inventory.contractVersionId}:${photosCount}`,
      )}</p>
      <p>Este inventario sirve como soporte documental del estado inicial del inmueble al momento de la entrega. No reemplaza el contrato de arrendamiento, sino que hace parte de sus anexos cuando las partes lo aceptan.</p>
    </article>
  `;
  return { html, hash: generateDocumentHash(html) };
}

