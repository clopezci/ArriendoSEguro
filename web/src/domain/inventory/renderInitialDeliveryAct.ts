import { generateDocumentHash } from "@/domain/contracts/hash";
import type { InventoryKey, InventoryMeterReading } from "./types";

export function renderInitialDeliveryAct(input: {
  deliveryDate: string;
  propertyAddress: string;
  landlordName: string;
  tenantName: string;
  observations: string;
  keys: InventoryKey[];
  meterReadings: InventoryMeterReading[];
  contractId: string;
  contractVersionId: string;
  inventoryId: string;
  inventorySummary?: string;
  photosCount?: number;
}) {
  const keysText = input.keys.length
    ? `<ul>${input.keys.map((k) => `<li>${k.keyType}: ${k.quantity}</li>`).join("")}</ul>`
    : "<p>Sin llaves registradas.</p>";
  const metersText = input.meterReadings.length
    ? `<ul>${input.meterReadings.map((m) => `<li>${m.meterType}: ${m.readingValue}</li>`).join("")}</ul>`
    : "<p>Sin lecturas de medidores.</p>";

  const html = `
    <article>
      <h1>ACTA DE ENTREGA INICIAL DEL INMUEBLE</h1>
      <p>En la fecha ${input.deliveryDate}, EL ARRENDADOR (${input.landlordName}) hace entrega material del inmueble ubicado en ${input.propertyAddress} a EL ARRENDATARIO (${input.tenantName}), quien declara recibirlo para el uso de vivienda conforme al contrato de arrendamiento suscrito entre las partes.</p>
      <p>Las partes dejan constancia de que el estado del inmueble fue documentado mediante inventario inicial guiado en la plataforma ArriendoSeguro, incluyendo zonas seleccionadas, fotografías, observaciones, estado de elementos, medidores, llaves y demás información registrada.</p>
      <p>El inventario inicial generado hace parte integral de la presente acta como anexo del contrato.</p>
      <h2>Resumen del inventario</h2>
      <p>${input.inventorySummary ?? "Sin resumen disponible."}</p>
      <p>Número de fotos registradas: ${input.photosCount ?? 0}</p>
      <h2>Llaves y controles entregados</h2>
      ${keysText}
      <h2>Medidores registrados</h2>
      ${metersText}
      <h2>Observaciones generales</h2>
      <p>${input.observations || "Sin observaciones."}</p>
      <p>La presente acta no sustituye el contrato de arrendamiento. Su finalidad es dejar soporte documental de la entrega inicial del inmueble.</p>
      <p>Para constancia, las partes aceptan el contenido de esta acta mediante la plataforma ArriendoSeguro.</p>
      <p>Contrato: ${input.contractId} / Versión: ${input.contractVersionId}</p>
    </article>
  `;
  return { html, hash: generateDocumentHash(html) };
}

