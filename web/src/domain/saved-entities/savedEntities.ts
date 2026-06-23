import type { ColombianNotificationAddressParts } from "@/domain/colombia/structured-address";

/**
 * Datos del dueño y de sus inmuebles **guardados por cuenta** (`ownerUid`) para
 * reutilizarlos en contratos futuros. NO se guardan declaraciones bajo juramento
 * (oaths): deben re-aceptarse en cada contrato. Todo es dato propio del usuario
 * (Habeas Data: nadie ve datos ajenos; las consultas se filtran por uid del token).
 */
export const USER_LANDLORD_PROFILES_COLLECTION = "user_landlord_profiles";
export const USER_PROPERTIES_COLLECTION = "user_properties";

export type SavedLandlordProfile = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  city: string;
  email: string;
  phone: string;
  notificationAddress: string;
  notificationAddressParts: ColombianNotificationAddressParts | null;
};

export type SavedPropertyData = {
  address: string;
  city: string;
  department: string;
  type: string;
  registryNumber: string;
  commercialValue: number | null;
  monthlyRentProposed: number | null;
  addressParts: ColombianNotificationAddressParts | null;
};

export type SavedProperty = {
  id: string;
  label: string;
  property: SavedPropertyData;
  updatedAt?: string;
};

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Acepta el objeto de partes de dirección si es un objeto (dato propio); si no, null. */
function addressPartsOrNull(v: unknown): ColombianNotificationAddressParts | null {
  return v && typeof v === "object" ? (v as ColombianNotificationAddressParts) : null;
}

/**
 * Sanea el perfil del arrendador a guardar. Devuelve `null` si faltan los
 * mínimos (nombre y documento). Nunca produce `undefined` (Firestore lo rechaza).
 */
export function sanitizeSavedProfile(input: unknown): SavedLandlordProfile | null {
  const o = (input ?? {}) as Record<string, unknown>;
  const fullName = str(o.fullName, 160);
  const documentNumber = str(o.documentNumber, 40);
  if (!fullName || !documentNumber) return null;
  return {
    fullName,
    documentType: str(o.documentType, 20) || "CC",
    documentNumber,
    city: str(o.city, 80),
    email: str(o.email, 160),
    phone: str(o.phone, 40),
    notificationAddress: str(o.notificationAddress, 300),
    notificationAddressParts: addressPartsOrNull(o.notificationAddressParts),
  };
}

/** Sanea los datos de un inmueble a guardar (sin oaths). Nunca produce `undefined`. */
export function sanitizeSavedPropertyData(input: unknown): SavedPropertyData {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    address: str(o.address, 300),
    city: str(o.city, 80),
    department: str(o.department, 80),
    type: str(o.type, 60),
    registryNumber: str(o.registryNumber, 80),
    commercialValue: numOrNull(o.commercialValue),
    monthlyRentProposed: numOrNull(o.monthlyRentProposed),
    addressParts: addressPartsOrNull(o.addressParts),
  };
}

/** Nombre amigable del inmueble; si va vacío, usa la dirección como respaldo. */
export function sanitizePropertyLabel(label: unknown, property: SavedPropertyData): string {
  const l = str(label, 80);
  return l || property.address || "Inmueble guardado";
}
