/**
 * Dirección urbana colombiana para “dirección de notificación” en contratos.
 *
 * En ciudades con malla tipo (p. ej. Bogotá, Medellín), la costumbre es expresar la ubicación como
 * [Tipo de vía] [Número] # [cruce]-[placa], más barrio y complementos. Eso alinea lectura con
 * costumbre notarial y catastral sin pretender sustituir la validación catastral oficial.
 *
 * El usuario arma la dirección con listas acotadas para evitar texto libre ilegible o imposible de auditar.
 */

import { z } from "zod";
import {
  toTitleCaseEs,
  toUpperTrimmed,
  trimAndCollapse,
} from "@/lib/text/sanitize";

/** Tipos de vía frecuentes en norma urbana colombiana (nomenclatura de vías). */
export const VIA_TIPO_VALUES = [
  "CALLE",
  "CARRERA",
  "AVENIDA",
  "DIAGONAL",
  "TRANSVERSAL",
  "CIRCULAR",
  "AVENIDA_CARRERA",
  "AUTOPISTA",
  "OTRO",
  "VEREDAL",
] as const;

export type ViaTipoColombia = (typeof VIA_TIPO_VALUES)[number];

export const VIA_TIPO_LABELS: Record<ViaTipoColombia, string> = {
  CALLE: "Calle",
  CARRERA: "Carrera",
  AVENIDA: "Avenida",
  DIAGONAL: "Diagonal",
  TRANSVERSAL: "Transversal",
  CIRCULAR: "Circular",
  AVENIDA_CARRERA: "Avenida Carrera",
  AUTOPISTA: "Autopista",
  OTRO: "Otro (especificar)",
  VEREDAL: "Veredal / rural",
};

export interface ColombianNotificationAddressParts {
  viaTipo: ViaTipoColombia;
  /** Denominación si `viaTipo === "OTRO"` (ej. “Autopista Norte”). */
  viaTipoOtro?: string;
  /** Número principal de la vía (ej. 72). Opcional para direcciones veredales. */
  viaNumero?: string;
  /** Sufijo tipo 45A — letras mayúsculas opcionales. */
  viaLetra?: string;
  /** Primer número tras # (cruce). Opcional para direcciones veredales. */
  cruceNumero?: string;
  /** Placa o número de puerta (puede incluir bis, etc.). Opcional en veredal. */
  placa?: string;
  /** Apto, interior, conjunto… */
  complemento?: string;
  /** Barrio o localidad. Opcional para direcciones veredales. */
  barrio?: string;
  // ── Dirección veredal / rural (cuando viaTipo === "VEREDAL") ──
  /** Nombre de la vía rural (ej. "Vía a La Calera km 5"). */
  viaRural?: string;
  /** Vereda donde está el predio. */
  vereda?: string;
  /** Parcelación / finca / lote. */
  parcelacion?: string;
  /** Tipo de predio (casa campestre, finca, lote, etc.). */
  tipoPredio?: string;
  /** Observaciones para ubicar el predio. */
  obsRurales?: string;
}

const zVia = z.enum(VIA_TIPO_VALUES);

export const colombianNotificationAddressPartsSchema = z
  .object({
    viaTipo: zVia,
    viaTipoOtro: z.string().max(80).optional(),
    // Urbanos: opcionales a nivel base; se exigen por superRefine cuando NO es veredal.
    viaNumero: z.string().regex(/^\d{0,3}$/, "Solo dígitos (1 a 3).").optional().or(z.literal("")),
    viaLetra: z
      .string()
      .max(2)
      .regex(/^[A-Za-z]{0,2}$/, "Máximo 2 letras.")
      .optional()
      .or(z.literal("")),
    cruceNumero: z.string().max(4).regex(/^\d{0,3}$/, "Número de cruce inválido.").optional().or(z.literal("")),
    placa: z.string().max(8).regex(/^[\dA-Za-z\-]*$/, "Placa inválida.").optional().or(z.literal("")),
    complemento: z.string().max(120).optional().or(z.literal("")),
    barrio: z.string().max(80).optional().or(z.literal("")),
    // Veredales / rurales (todos opcionales; se exige la vereda cuando es veredal).
    viaRural: z.string().max(120).optional().or(z.literal("")),
    vereda: z.string().max(120).optional().or(z.literal("")),
    parcelacion: z.string().max(120).optional().or(z.literal("")),
    tipoPredio: z.string().max(120).optional().or(z.literal("")),
    obsRurales: z.string().max(300).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.viaTipo === "OTRO") {
      const t = (data.viaTipoOtro ?? "").trim();
      if (t.length < 3) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["viaTipoOtro"], message: "Escribe cómo se llama la vía cuando eliges «Otro»." });
      }
    }
    if (data.viaTipo === "VEREDAL") {
      // Dirección rural: solo exigimos la vereda; los campos urbanos no aplican.
      if ((data.vereda ?? "").trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["vereda"], message: "Indica la vereda del predio." });
      }
    } else {
      // Dirección urbana: exigimos los campos de malla.
      if (!/^\d{1,3}$/.test((data.viaNumero ?? "").trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["viaNumero"], message: "Indica el número de la vía (solo dígitos, ej. 72)." });
      }
      if (!/^\d{1,3}$/.test((data.cruceNumero ?? "").trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cruceNumero"], message: "Indica el número de cruce." });
      }
      if ((data.placa ?? "").trim().length < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["placa"], message: "Indica la placa / número local." });
      }
      if ((data.barrio ?? "").trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["barrio"], message: "Indica el barrio o localidad." });
      }
    }
  });

export type ColombianAddressZod = z.infer<typeof colombianNotificationAddressPartsSchema>;

/** Prefijo de nombres de campo en formularios (`addr*` partes, `propAddr*` inmueble). */
export type UrbanAddressFormPrefix = "addr" | "propAddr";

/**
 * Lee campos `{prefix}ViaTipo`, `{prefix}ViaNumero`, etc. del `FormData`.
 *
 * Aplica sanitización ANTES de validar para que la base de datos quede
 * con datos homogéneos: trim + colapso de espacios y mayúsculas iniciales
 * en partes propias (barrio, complemento, especificación de la vía).
 * Si el tipo de vía no es «Otro», ignora el texto de especificación para
 * evitar datos colgados.
 */
export function parseUrbanAddressFromForm(formData: FormData, prefix: UrbanAddressFormPrefix) {
  const raw = (suffix: string) => String(formData.get(`${prefix}${suffix}`) ?? "");
  const viaTipo = trimAndCollapse(raw("ViaTipo")).toUpperCase() as ViaTipoColombia;
  const viaTipoOtro =
    viaTipo === "OTRO" ? toTitleCaseEs(raw("ViaTipoOtro")) || undefined : undefined;
  return colombianNotificationAddressPartsSchema.safeParse({
    viaTipo,
    viaTipoOtro,
    viaNumero: trimAndCollapse(raw("ViaNumero")),
    viaLetra: toUpperTrimmed(raw("ViaLetra")) || undefined,
    cruceNumero: trimAndCollapse(raw("CruceNumero")),
    placa: toUpperTrimmed(raw("Placa")),
    complemento: toTitleCaseEs(raw("Complemento")) || undefined,
    barrio: toTitleCaseEs(raw("Barrio")),
    // Veredales / rurales.
    viaRural: toTitleCaseEs(raw("ViaRural")) || undefined,
    vereda: toTitleCaseEs(raw("Vereda")) || undefined,
    parcelacion: toTitleCaseEs(raw("Parcelacion")) || undefined,
    tipoPredio: toTitleCaseEs(raw("TipoPredio")) || undefined,
    obsRurales: trimAndCollapse(raw("ObsRurales")) || undefined,
  });
}

/** Alias: dirección de notificación de partes (`addr*`). */
export function parseNotificationAddressFromForm(formData: FormData) {
  return parseUrbanAddressFromForm(formData, "addr");
}

/**
 * Texto único para el contrato y plantillas; legible y alineado con costumbre local.
 */
export function formatColombianNotificationAddress(parts: ColombianNotificationAddressParts): string {
  // Dirección veredal / rural: texto propio (sin malla urbana).
  if (parts.viaTipo === "VEREDAL") {
    const bits = [
      "Zona veredal",
      parts.vereda?.trim() ? `Vereda ${parts.vereda.trim()}` : "",
      parts.viaRural?.trim() ? `Vía ${parts.viaRural.trim()}` : "",
      parts.parcelacion?.trim() ? `Parcelación ${parts.parcelacion.trim()}` : "",
      parts.tipoPredio?.trim() ? `Predio: ${parts.tipoPredio.trim()}` : "",
      parts.obsRurales?.trim() ? `Obs.: ${parts.obsRurales.trim()}` : "",
    ].filter(Boolean);
    return bits.join(", ");
  }
  const principal =
    parts.viaTipo === "OTRO"
      ? `${(parts.viaTipoOtro ?? "").trim()} ${formatViaPrincipal(parts)}`.trim()
      : `${VIA_TIPO_LABELS[parts.viaTipo]} ${formatViaPrincipal(parts)}`.trim();
  const comp = parts.complemento?.trim()
    ? `, ${parts.complemento.trim()}`
    : "";
  return `${principal} # ${parts.cruceNumero ?? ""}-${parts.placa ?? ""}${comp}, Barrio ${(parts.barrio ?? "").trim()}`;
}

function formatViaPrincipal(parts: ColombianNotificationAddressParts): string {
  const base = `${parts.viaNumero ?? ""}${(parts.viaLetra ?? "").toUpperCase()}`;
  return base;
}
