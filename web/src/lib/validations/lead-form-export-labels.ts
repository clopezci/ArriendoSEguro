/**
 * Etiquetas legibles para export CSV de encuestas (lead_forms), alineadas al formulario público.
 */
import { Timestamp } from "firebase-admin/firestore";

function isoFirestoreDate(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return "";
}

const PROPERTY: Record<string, string> = {
  yes_rented_before: "Sí, y ya la he arrendado antes",
  yes_first_time: "Sí, pero sería mi primera vez",
  evaluating: "Estoy evaluándolo",
  no_property: "No tengo propiedad para arrendar",
};

const CHANNEL: Record<string, string> = {
  agency: "Por inmobiliaria o agencia",
  direct: "Directamente entre particulares",
  both: "Ambas opciones",
  never: "Aún no he arrendado",
};

const CONCERN: Record<string, string> = {
  unclear_contract: "No tener un contrato claro",
  counterparty_validation: "No validar bien a la otra parte",
  payment_risk: "Problemas con pagos o incumplimientos",
  delivery_state: "Problemas con la entrega o estado del inmueble",
  conflict_resolution: "No saber qué hacer si hay un conflicto",
  all: "Todo lo anterior",
};

const APP_INTEREST: Record<string, string> = {
  yes: "Sí",
  maybe: "Tal vez",
  no: "No",
};

const Q4_NO: Record<string, string> = {
  price: "Precio",
  hard_to_use: "Me parece difícil de usar",
  not_needed: "No lo considero necesario",
  prefer_agency: "Prefiero una agencia",
  other: "Otro",
};

const WILLING: Record<string, string> = {
  early_bird_50: "~$49.900 COP (precio lanzamiento primeros inscritos)",
  list_90: "Cerca de $89.900 (precio de lista)",
  under_50: "Menos de $50.000",
  range_50_70: "Entre $50.000 y $70.000",
  range_70_100: "Entre $70.000 y $100.000",
  would_not_pay: "No pagaría por este servicio",
};

const VALUED: Record<string, string> = {
  guided_contract: "Generación automática del contrato guiándote fácilmente",
  signature: "Firma electrónica",
  inventory: "Inventario y actas",
  payments: "Registro de pagos",
  evaluation: "Evaluación estructurada de la experiencia",
  integrated: "Todo integrado",
  other: "Otro",
};

const SOURCE: Record<string, string> = {
  landing: "Landing principal",
  landing_fase_inicial: "Landing (fase inicial)",
  landing_mvp: "Landing (fase inicial)",
  "entiendelo-facil": "Entiéndelo fácil",
  landing_comercial_interno: "Landing comercial interno",
};

function mapLabel(table: Record<string, string>, raw: unknown): string {
  if (raw == null || raw === "") return "";
  const k = String(raw).trim();
  return table[k] ?? k;
}

export function labelPropertyStatusAnswer(v: unknown) {
  return mapLabel(PROPERTY, v);
}

export function labelRentalChannelAnswer(v: unknown) {
  return mapLabel(CHANNEL, v);
}

export function labelMainConcernAnswer(v: unknown) {
  return mapLabel(CONCERN, v);
}

export function labelAppInterestAnswer(v: unknown) {
  return mapLabel(APP_INTEREST, v);
}

export function labelQ4NoReason(v: unknown) {
  return mapLabel(Q4_NO, v);
}

export function labelWillingnessToPayAnswer(v: unknown) {
  return mapLabel(WILLING, v);
}

export function labelMostValuableModuleAnswer(v: unknown) {
  return mapLabel(VALUED, v);
}

export function labelSourcePage(v: unknown) {
  return mapLabel(SOURCE, v);
}

export function labelContactConsent(v: unknown): string {
  if (v === true || v === "true") return "Sí";
  if (v === false || v === "false") return "No";
  return v == null ? "" : String(v);
}

/** Fila para la tabla del panel /admin (mismas preguntas que ve el público en la encuesta). */
export function buildAdminSurveyRow(id: string, x: Record<string, unknown>): Record<string, string> {
  const fecha = isoFirestoreDate(x.createdAt ?? x.createdAtServer);

  const sp = (x.sourcePage as string | undefined) ?? "";
  const email = x.email == null ? "" : String(x.email);

  const entries: [string, string][] = [
    ["ID", id],
    ["Fecha y hora (UTC)", fecha],
    ["Correo electrónico", email],
    [
      "Página de origen",
      sp ? `${labelSourcePage(sp)} (código: ${sp})` : "",
    ],
    [
      "1. ¿Actualmente tienes una propiedad para arrendar o la arrendarás pronto?",
      labelPropertyStatusAnswer(x.propertyStatusAnswer),
    ],
    [
      "2. Cuando has arrendado o pensado arrendar, ¿por cuál medio lo harías principalmente?",
      labelRentalChannelAnswer(x.rentalChannelAnswer),
    ],
    [
      "3. ¿Qué es lo que más te preocupa al arrendar una propiedad?",
      labelMainConcernAnswer(x.mainConcernAnswer),
    ],
    [
      "4. ¿Usarías una app de bajo costo que te ayude a formalizar un arriendo ya acordado con contrato, firma electrónica, inventario, soportes y más adelante acceso a especialistas si lo deseas?",
      labelAppInterestAnswer(x.appInterestAnswer),
    ],
    ["Si respondiste NO, ¿por qué no la usarías?", labelQ4NoReason(x.q4NoReason)],
    ["Cuéntanos cuál", String(x.q4NoReasonOther ?? "").trim()],
    [
      "5. ¿Qué valor te parecería razonable pagar una sola vez por contrato registrado, por este servicio?",
      labelWillingnessToPayAnswer(x.willingnessToPayAnswer),
    ],
    [
      "6. ¿Qué debería contener la aplicación para que sea valiosa para ti?",
      labelMostValuableModuleAnswer(x.mostValuableModuleAnswer),
    ],
    ["¿Qué debería contener?", String(x.mostValuableModuleOther ?? "").trim()],
    ["Consentimiento de contacto", labelContactConsent(x.contactConsent)],
    ["Navegador (user agent)", String(x.userAgent ?? "").trim()],
  ];

  return Object.fromEntries(entries);
}

/** Encabezados CSV (una fila) en el mismo orden que las columnas exportadas. */
export const LEAD_FORM_CSV_HEADERS = [
  "ID del registro",
  "Fecha y hora (UTC)",
  "Correo electrónico",
  "Página de origen (texto)",
  "Página de origen (código)",
  "1. Propiedad para arrendar (texto)",
  "1. Propiedad para arrendar (código)",
  "2. Medio de arriendo (texto)",
  "2. Medio de arriendo (código)",
  "3. Principal preocupación (texto)",
  "3. Principal preocupación (código)",
  "4. ¿Usarías app de bajo costo? (texto)",
  "4. ¿Usarías app de bajo costo? (código)",
  "4b. Si dijo NO: motivo (texto)",
  "4b. Si dijo NO: motivo (código)",
  "4b. Si dijo NO otro: detalle",
  "5. Valor razonable una sola vez (texto)",
  "5. Valor razonable una sola vez (código)",
  "6. Qué debería contener la app (texto)",
  "6. Qué debería contener la app (código)",
  "6. Si eligió OTRO: detalle",
  "Consentimiento de contacto",
  "Navegador (user agent)",
] as const;
