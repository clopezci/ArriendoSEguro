/**
 * Programa de referidos (bucle de crecimiento, sin costo).
 *
 * - Cada usuario tiene un **código** de invitación; el invitado que llega con
 *   ese código y crea su cuenta queda como referido **pendiente**.
 * - El **descuento** para el referido lo aprueba el fundador desde `/admin`;
 *   el porcentaje es configurable (por defecto 50%).
 * - El descuento aplica al precio de checkout del Plan Plus **solo** cuando el
 *   referido está **aprobado** y el programa está habilitado.
 *
 * Módulo **puro** (sin Firebase ni red) para reusarlo en servidor/cliente y
 * cubrirlo con tests. La generación de códigos vive en el route (usa azar
 * seguro del servidor).
 */

import { z } from "zod";

export const REFERRAL_CONFIG_COLLECTION = "app_settings";
export const REFERRAL_CONFIG_DOC_ID = "referral_config";
/** Doc id = código; valor: { ownerUid, ownerEmail }. */
export const REFERRAL_CODES_COLLECTION = "referral_codes";
/** Doc id = uid del referido (una referencia por persona referida). */
export const REFERRALS_COLLECTION = "referrals";

export const DEFAULT_REFERRAL_DISCOUNT_PERCENT = 50;
export const MAX_REFERRAL_DISCOUNT_PERCENT = 100;

/**
 * Modelo: se comparte con ~3 personas (`SUGGESTED_SHARE_COUNT`) y la recompensa
 * (2º contrato gratis / firma) se otorga cuando **al menos 2** de ellas usan la
 * app de verdad (crean su contrato). Este es el número de referidos CALIFICADOS
 * necesarios para la recompensa.
 */
export const QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK = 2;
/** Número sugerido de personas a invitar (solo para la mensajería). */
export const SUGGESTED_SHARE_COUNT = 3;

/**
 * @deprecated Ya no se ofrece un micropago para "desbloquear la firma": la firma
 * electrónica va incluida en el precio de introducción del contrato. Se conserva
 * solo por compatibilidad de tests; no se muestra al usuario.
 */
export const SIGNATURE_UNLOCK_MICRO_FEE_COP = 10_000;

/** Un referido "califica" cuando el referido usó la app de verdad (generó un contrato). */
export function countQualifiedReferrals(referrals: { qualified?: boolean }[]): number {
  return referrals.filter((r) => r.qualified === true).length;
}

/** ¿El usuario ganó el "segundo contrato gratis" por referidos calificados (al menos 2)? */
export function signatureUnlockedByReferrals(qualifiedCount: number): boolean {
  return qualifiedCount >= QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK;
}

export type ReferralStatus = "pending" | "approved" | "rejected";

export interface ReferralConfig {
  enabled: boolean;
  discountPercent: number;
  updatedAt?: string;
  updatedByEmail?: string;
}

const configSchema = z.object({
  enabled: z.boolean().optional(),
  discountPercent: z.number().int().min(0).max(MAX_REFERRAL_DISCOUNT_PERCENT).optional(),
  updatedAt: z.string().optional(),
  updatedByEmail: z.string().optional(),
});

export function defaultReferralConfig(): ReferralConfig {
  return { enabled: true, discountPercent: DEFAULT_REFERRAL_DISCOUNT_PERCENT };
}

export function resolveReferralConfig(stored: unknown): ReferralConfig {
  const parsed = configSchema.safeParse(stored);
  if (!parsed.success) return defaultReferralConfig();
  const d = parsed.data;
  return {
    enabled: d.enabled ?? true,
    discountPercent:
      typeof d.discountPercent === "number" ? d.discountPercent : DEFAULT_REFERRAL_DISCOUNT_PERCENT,
    updatedAt: d.updatedAt,
    updatedByEmail: d.updatedByEmail,
  };
}

/** Códigos legibles: 6–10 caracteres alfanuméricos en mayúscula. */
const CODE_RE = /^[A-Z0-9]{6,10}$/;

export function normalizeReferralCode(raw: string): string {
  return (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidReferralCodeFormat(raw: string): boolean {
  return CODE_RE.test(normalizeReferralCode(raw));
}

/**
 * Precio del Plan Plus con el descuento de referido aplicado, **solo** si el
 * programa está habilitado y el referido está aprobado. Redondea hacia abajo.
 */
export function referralDiscountedCheckoutCop(
  checkoutCop: number,
  config: ReferralConfig,
  referralStatus: ReferralStatus | null | undefined,
): { finalCop: number; applied: boolean; discountPercent: number } {
  const base = Number.isFinite(checkoutCop) && checkoutCop > 0 ? Math.floor(checkoutCop) : 0;
  const applies =
    config.enabled &&
    referralStatus === "approved" &&
    config.discountPercent > 0 &&
    config.discountPercent <= MAX_REFERRAL_DISCOUNT_PERCENT;
  if (!applies) {
    return { finalCop: base, applied: false, discountPercent: 0 };
  }
  const finalCop = Math.floor(base * (1 - config.discountPercent / 100));
  return { finalCop, applied: true, discountPercent: config.discountPercent };
}

/**
 * Reglas para registrar una referencia nueva. Devuelve el motivo de rechazo o
 * `ok` para crearla en estado `pending`.
 */
export function canRegisterReferral(params: {
  code: string;
  referrerUid: string | null;
  referredUid: string;
  alreadyReferred: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!isValidReferralCodeFormat(params.code)) {
    return { ok: false, reason: "Código de invitación inválido." };
  }
  if (!params.referrerUid) {
    return { ok: false, reason: "El código de invitación no existe." };
  }
  if (params.referrerUid === params.referredUid) {
    return { ok: false, reason: "No puedes referirte a ti mismo." };
  }
  if (params.alreadyReferred) {
    return { ok: false, reason: "Esta cuenta ya tiene una invitación registrada." };
  }
  return { ok: true };
}
