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
};

export interface ColombianNotificationAddressParts {
  viaTipo: ViaTipoColombia;
  /** Denominación si `viaTipo === "OTRO"` (ej. “Autopista Norte”). */
  viaTipoOtro?: string;
  /** Número principal de la vía (ej. 72). */
  viaNumero: string;
  /** Sufijo tipo 45A — letras mayúsculas opcionales. */
  viaLetra?: string;
  /** Primer número tras # (cruce). */
  cruceNumero: string;
  /** Placa o número de puerta (puede incluir bis, etc.). */
  placa: string;
  /** Apto, interior, conjunto… */
  complemento?: string;
  barrio: string;
}

const zVia = z.enum(VIA_TIPO_VALUES);

/** Número principal de la vía (solo dígitos; la letra va aparte). */
const zViaNumero = z
  .string()
  .min(1)
  .regex(/^\d{1,3}$/, "Indicá el número de la vía (solo dígitos, ej. 72).");

const zBarrio = z
  .string()
  .min(2, "Indicá el barrio o localidad.")
  .max(80)
  .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s.\-']+$/, "Usá solo letras, números y separadores habituales en el barrio.");

export const colombianNotificationAddressPartsSchema = z
  .object({
    viaTipo: zVia,
    viaTipoOtro: z.string().max(80).optional(),
    viaNumero: zViaNumero,
    viaLetra: z
      .string()
      .max(2)
      .regex(/^[A-Za-z]{0,2}$/, "Máximo 2 letras.")
      .optional()
      .or(z.literal("")),
    cruceNumero: z.string().min(1).max(4).regex(/^\d{1,3}$/, "Número de cruce inválido."),
    placa: z
      .string()
      .min(1)
      .max(8)
      .regex(/^[\dA-Za-z\-]+$/, "Placa inválida."),
    complemento: z.string().max(120).optional().or(z.literal("")),
    barrio: zBarrio,
  })
  .superRefine((data, ctx) => {
    if (data.viaTipo === "OTRO") {
      const t = (data.viaTipoOtro ?? "").trim();
      if (t.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["viaTipoOtro"],
          message: "Escribí cómo se llama la vía cuando elegís «Otro».",
        });
      }
    }
  });

export type ColombianAddressZod = z.infer<typeof colombianNotificationAddressPartsSchema>;

/** Prefijo de nombres de campo en formularios (`addr*` partes, `propAddr*` inmueble). */
export type UrbanAddressFormPrefix = "addr" | "propAddr";

/**
 * Lee campos `{prefix}ViaTipo`, `{prefix}ViaNumero`, etc. del `FormData`.
 * Si el tipo de vía no es «Otro», ignora el texto de especificación para evitar datos colgados.
 */
export function parseUrbanAddressFromForm(formData: FormData, prefix: UrbanAddressFormPrefix) {
  const g = (suffix: string) => String(formData.get(`${prefix}${suffix}`) ?? "").trim();
  const viaTipo = g("ViaTipo") as ViaTipoColombia;
  const viaTipoOtro = viaTipo === "OTRO" ? g("ViaTipoOtro") || undefined : undefined;
  return colombianNotificationAddressPartsSchema.safeParse({
    viaTipo,
    viaTipoOtro,
    viaNumero: g("ViaNumero"),
    viaLetra: g("ViaLetra") || undefined,
    cruceNumero: g("CruceNumero"),
    placa: g("Placa"),
    complemento: g("Complemento") || undefined,
    barrio: g("Barrio"),
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
  const principal =
    parts.viaTipo === "OTRO"
      ? `${(parts.viaTipoOtro ?? "").trim()} ${formatViaPrincipal(parts)}`.trim()
      : `${VIA_TIPO_LABELS[parts.viaTipo]} ${formatViaPrincipal(parts)}`.trim();
  const comp = parts.complemento?.trim()
    ? `, ${parts.complemento.trim()}`
    : "";
  return `${principal} # ${parts.cruceNumero}-${parts.placa}${comp}, Barrio ${parts.barrio.trim()}`;
}

function formatViaPrincipal(parts: ColombianNotificationAddressParts): string {
  const base = `${parts.viaNumero}${(parts.viaLetra ?? "").toUpperCase()}`;
  return base;
}
