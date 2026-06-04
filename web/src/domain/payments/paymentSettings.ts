/**
 * Configuración de método de pago del contrato (para recordarle al inquilino).
 *
 * A elección del dueño: **cuenta** (entidad/tipo/número), **QR** (imagen) o
 * **ninguno**. Si elige cuenta o QR, debe **aceptar** que esos datos se usarán
 * únicamente para recordarle el pago al inquilino (Habeas Data / minimización).
 *
 * ArriendoSeguro NO recauda ni custodia dinero; solo facilita el recordatorio y
 * la constancia. Módulo **puro** (sin Firebase ni red).
 */

export const PAYMENT_SETTINGS_COLLECTION = "contract_payment_settings";

export type PaymentMethodKind = "account" | "qr" | "none";

export const ACCOUNT_TYPES = ["ahorros", "corriente"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface PaymentSettings {
  method: PaymentMethodKind;
  bank?: string;
  accountType?: AccountType;
  accountNumber?: string;
  qrStoragePath?: string;
  consentAccepted: boolean;
  consentAt?: string;
  updatedAt?: string;
  updatedByUid?: string;
}

export interface PaymentSettingsInput {
  method?: unknown;
  bank?: unknown;
  accountType?: unknown;
  accountNumber?: unknown;
  qrStoragePath?: unknown;
  consentAccepted?: unknown;
}

function isAccountType(v: unknown): v is AccountType {
  return typeof v === "string" && (ACCOUNT_TYPES as readonly string[]).includes(v);
}

export function validatePaymentSettings(
  input: PaymentSettingsInput,
): { ok: true; value: Omit<PaymentSettings, "updatedAt" | "updatedByUid"> } | { ok: false; message: string } {
  const method = input.method;
  if (method === "none") {
    return { ok: true, value: { method: "none", consentAccepted: false } };
  }
  if (method !== "account" && method !== "qr") {
    return { ok: false, message: "Método de pago inválido." };
  }
  if (!input.consentAccepted) {
    return { ok: false, message: "Debes aceptar el aviso para compartir tus datos de pago con el inquilino." };
  }

  if (method === "account") {
    const bank = String(input.bank ?? "").trim();
    const accountNumber = String(input.accountNumber ?? "").replace(/\s+/g, "");
    if (bank.length < 2) return { ok: false, message: "Indica la entidad bancaria." };
    if (!isAccountType(input.accountType)) return { ok: false, message: "Indica el tipo de cuenta (ahorros o corriente)." };
    if (!/^\d{5,25}$/.test(accountNumber)) return { ok: false, message: "El número de cuenta debe tener solo dígitos (5 a 25)." };
    return {
      ok: true,
      value: {
        method: "account",
        bank: bank.slice(0, 80),
        accountType: input.accountType,
        accountNumber,
        consentAccepted: true,
        consentAt: undefined,
      },
    };
  }

  // qr
  const qrStoragePath = String(input.qrStoragePath ?? "").trim();
  if (!qrStoragePath.startsWith("gs://")) {
    return { ok: false, message: "Sube la imagen del QR antes de guardar." };
  }
  return { ok: true, value: { method: "qr", qrStoragePath, consentAccepted: true } };
}

/** Enmascara el número de cuenta para mostrarlo en paneles/logs (deja últimos 4). */
export function maskAccountNumber(accountNumber: string | undefined): string {
  const n = (accountNumber ?? "").trim();
  if (n.length <= 4) return n ? "••••" : "";
  return `••••${n.slice(-4)}`;
}

/** Resumen legible del método para el inquilino (sin enmascarar: él necesita pagar). */
export function describePaymentMethodForTenant(s: PaymentSettings | null | undefined): string {
  if (!s || s.method === "none") return "El arrendador no configuró un medio de pago en la plataforma.";
  if (s.method === "qr") return "Escanea el código QR del arrendador para pagar.";
  return `Cuenta ${s.accountType ?? ""} ${s.bank ?? ""} N.º ${s.accountNumber ?? ""}`.trim();
}
