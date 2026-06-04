/**
 * Datos 100 % ficticios para el recorrido /demo.
 * No usar como referencia legal ni como datos reales de personas.
 */

export const DEMO_BADGE = "Ejemplo demostrativo";

export const demoLandlord = {
  role: "Arrendador",
  fullName: "Ana Lucía Ficticia Rendón",
  document: "CC 12.345.678 (ejemplo)",
  city: "Bogotá D.C.",
  email: "ana.ejemplo@correo-demo.local",
  phone: "3000000000",
  address: "Calle 100 # 15-20, Barrio Chicó (ejemplo)",
};

export const demoTenant = {
  role: "Arrendatario",
  fullName: "Carlos Demo Usuario Prueba",
  document: "CC 98.765.432 (ejemplo)",
  city: "Bogotá D.C.",
  email: "carlos.ejemplo@correo-demo.local",
  phone: "3110000000",
  address: "Carrera 7 # 40-10, Barrio La Candelaria (ejemplo)",
};

export const demoCodebtor = {
  role: "Codeudor solidario",
  fullName: "Laura Ejemplo Codeudora",
  document: "CC 11.222.333 (ejemplo)",
  address: "Diagonal 45 # 12-88, Barrio Teusaquillo (ejemplo)",
};

export const demoProperty = {
  address: "Carrera 11 # 82-64, Barrio Chapinero (ejemplo)",
  city: "Bogotá D.C.",
  department: "Cundinamarca",
  type: "Apartamento",
  registry: "50N-1234567 (ejemplo)",
  rent: "$ 2.800.000",
  commercialHint: "Valor comercial de ejemplo",
};

/** HTML estático solo para vista previa en pantalla; no es un contrato válido. */
export function buildDemoContractSnippet(withCodebtor: boolean): string {
  const codebtorBlock = withCodebtor
    ? `<p><strong>Comparece</strong> ${demoCodebtor.fullName}, como codeudor solidario… (texto resumido de ejemplo).</p>`
    : `<p><em>Este ejemplo no incluye codeudor solidario.</em></p>`;
  return `
<div class="guided-demo-contract-inner text-left text-[13px] leading-relaxed text-slate-800">
  <h3 class="mb-2 text-center text-base font-semibold text-slate-900">CONTRATO DE ARRENDAMIENTO (VISTA DEMO)</h3>
  <p class="mb-2 text-slate-600">Entre ${demoLandlord.fullName} (EL ARRENDADOR) y ${demoTenant.fullName} (EL ARRENDATARIO)…</p>
  ${codebtorBlock}
  <p class="mt-2"><strong>PRIMERA. OBJETO.</strong> Inmueble urbano ubicado en ${demoProperty.address}, ${demoProperty.city}.</p>
  <p class="mt-2"><strong>TERCERA. CANON.</strong> Canon mensual de ejemplo ${demoProperty.rent}, sujeto a revisión en Plan Plus.</p>
  <p class="mt-2"><strong>SÉPTIMA. SERVICIOS.</strong> Garantía para servicios públicos (Art. 15, Ley 820) cuando las partes la pacten, hasta el valor de dos períodos (ejemplo).</p>
  <p class="mt-3 text-[11px] text-slate-500">…cláusulas omitidas a propósito en esta vista. Generar el contrato es gratis; la firma y el respaldo se activan con Plan Plus…</p>
</div>`.trim();
}

export const demoInventoryZones = [
  { zone: "Cocina", items: "Estufa, mesón, gabinetes", photos: 4 },
  { zone: "Baño principal", items: "Lavamanos, ducha, sanitario", photos: 3 },
  { zone: "Habitación 1", items: "Closet, ventana", photos: 5 },
  { zone: "Medidores", items: "Luz, gas, acueducto", photos: 3 },
  { zone: "Llaves", items: "2 llaves perilla, 1 control garaje", photos: 2 },
];

export const demoPayments = [
  { month: "Febrero 2026", due: "5 feb", amount: "$ 2.800.000", status: "Pagado (simulado)" },
  { month: "Marzo 2026", due: "5 mar", amount: "$ 2.800.000", status: "Próximo" },
  { month: "Abril 2026", due: "5 abr", amount: "$ 2.800.000", status: "Programado" },
];

export const demoAnnexes = [
  { name: "Contrato firmado", kind: "PDF", state: "Solo en Plan Plus" },
  { name: "Inventario inicial", kind: "PDF", state: "Solo en Plan Plus" },
  { name: "Acta de entrega", kind: "PDF", state: "Solo en Plan Plus" },
  { name: "Evidencia de firma electrónica", kind: "Anexo", state: "Solo en Plan Plus" },
];

export const guidedDemoStepMeta = [
  { id: "expediente", title: "Expediente de arriendo", blurb: "Ficha única con partes e inmueble." },
  { id: "contrato", title: "Contrato", blurb: "Generar es gratis; vista con marca de agua." },
  { id: "firma", title: "Firma electrónica", blurb: "Estado por parte (Plan Plus)." },
  { id: "inventario", title: "Inventario guiado", blurb: "Zonas y fotos (Plan Plus)." },
  { id: "pagos", title: "Pagos y recordatorios", blurb: "Calendario y soportes (Plan Plus)." },
  { id: "anexos", title: "Anexos y trazabilidad", blurb: "Documentos ligados al expediente." },
  { id: "extras", title: "Más en Plan Plus", blurb: "Reputación, alertas de vencimiento y garantía de servicios." },
] as const;

export type GuidedDemoStepId = (typeof guidedDemoStepMeta)[number]["id"];
