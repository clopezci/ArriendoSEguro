/**
 * Motor de reglas de estudio de arrendamiento (puro, sin I/O). La agencia define
 * reglas; se evalúan contra los datos capturados del solicitante (ingresos, tipo
 * de contrato, codeudor, campos personalizados) y, más adelante, resultados de
 * APIs externas (score DataCrédito, antecedentes) en la Fase B externa.
 *
 * No usa "server-only": el panel de la agencia lo importa para evaluar en vivo.
 */

export type StudyOperator = ">=" | "<=" | "==" | "!=" | "in" | "exists";

export interface StudyRule {
  id: string;
  label: string;
  /** "income" | "contractType" | "hasCodebtor" | "incomeTimesCanon" | "score" | <clave de campo personalizado> */
  field: string;
  operator: StudyOperator;
  value?: string | number | string[];
  /** Obligatoria: si falla → rechazado. Opcional: si falla → revisar. */
  required: boolean;
}

export interface StudyContext {
  income?: number;
  contractType?: string;
  hasCodebtor?: boolean;
  /** Canon de referencia para la regla "income ≥ N × canon". */
  canonReference?: number;
  /** Score DataCrédito (Fase B externa). */
  score?: number;
  /** Respuestas a campos personalizados. */
  custom?: Record<string, string>;
}

export type StudyStatus = "approved" | "review" | "rejected";

export interface StudyRuleResult {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

export interface StudyEvaluation {
  status: StudyStatus;
  results: StudyRuleResult[];
}

const KNOWN_FIELDS = new Set(["income", "contractType", "hasCodebtor", "incomeTimesCanon", "score"]);

function fieldValue(field: string, ctx: StudyContext): { value: unknown; label: string } {
  switch (field) {
    case "income":
      return { value: ctx.income, label: "Ingresos" };
    case "contractType":
      return { value: ctx.contractType, label: "Tipo de contrato" };
    case "hasCodebtor":
      return { value: ctx.hasCodebtor, label: "Tiene codeudor" };
    case "score":
      return { value: ctx.score, label: "Score DataCrédito" };
    case "incomeTimesCanon": {
      const ratio = ctx.income && ctx.canonReference ? ctx.income / ctx.canonReference : undefined;
      return { value: ratio, label: "Ingresos ÷ canon" };
    }
    default:
      return { value: ctx.custom?.[field], label: field };
  }
}

function compare(actual: unknown, op: StudyOperator, expected: StudyRule["value"]): boolean {
  if (op === "exists") return actual !== undefined && actual !== null && String(actual).trim() !== "";
  if (actual === undefined || actual === null || String(actual) === "") return false;
  if (op === "in") {
    const arr = Array.isArray(expected) ? expected.map((x) => String(x).toLowerCase()) : [String(expected).toLowerCase()];
    return arr.includes(String(actual).toLowerCase());
  }
  const num = typeof expected === "number" || (!Array.isArray(expected) && expected !== undefined && !Number.isNaN(Number(expected)));
  if (num && (op === ">=" || op === "<=")) {
    const a = Number(actual);
    const b = Number(expected);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return op === ">=" ? a >= b : a <= b;
  }
  if (op === "==") return String(actual).toLowerCase() === String(expected).toLowerCase();
  if (op === "!=") return String(actual).toLowerCase() !== String(expected).toLowerCase();
  return false;
}

/** Evalúa las reglas contra el contexto y devuelve diagnóstico + detalle por regla. */
export function evaluateStudy(rules: StudyRule[], ctx: StudyContext): StudyEvaluation {
  const results: StudyRuleResult[] = [];
  let anyRequiredFail = false;
  let anyOptionalFail = false;

  for (const rule of rules) {
    const { value, label } = fieldValue(rule.field, ctx);
    const ok = compare(value, rule.operator, rule.value);
    if (!ok) {
      if (rule.required) anyRequiredFail = true;
      else anyOptionalFail = true;
    }
    const shown = value === undefined || value === null || String(value) === "" ? "sin dato" : String(value);
    results.push({
      id: rule.id,
      label: rule.label,
      ok,
      required: rule.required,
      detail: `${label}: ${shown} ${rule.operator} ${Array.isArray(rule.value) ? rule.value.join("/") : rule.value ?? ""}`.trim(),
    });
  }

  const status: StudyStatus = anyRequiredFail ? "rejected" : anyOptionalFail ? "review" : "approved";
  return { status, results };
}

/** Etiqueta amigable de un campo conocido (para el editor de reglas). */
export function isKnownStudyField(field: string): boolean {
  return KNOWN_FIELDS.has(field);
}

/** Normaliza/acota reglas (para guardar). */
export function sanitizeStudyRules(input: unknown): StudyRule[] {
  if (!Array.isArray(input)) return [];
  const out: StudyRule[] = [];
  const used = new Set<string>();
  const ops: StudyOperator[] = [">=", "<=", "==", "!=", "in", "exists"];
  for (const raw of input.slice(0, 30)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 100) : "";
    const field = typeof r.field === "string" ? r.field.trim().slice(0, 60) : "";
    if (!label || !field) continue;
    const operator: StudyOperator = ops.includes(r.operator as StudyOperator) ? (r.operator as StudyOperator) : ">=";
    let id = typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 40) : `r${out.length + 1}`;
    while (used.has(id)) id = `${id}_2`;
    used.add(id);
    let value: StudyRule["value"];
    if (Array.isArray(r.value)) value = r.value.map((x) => String(x).slice(0, 60)).slice(0, 20);
    else if (typeof r.value === "number") value = r.value;
    else if (typeof r.value === "string") value = r.value.slice(0, 120);
    out.push({ id, label, field, operator, value, required: r.required !== false });
  }
  return out;
}
