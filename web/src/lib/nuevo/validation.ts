/**
 * Validación del flujo nuevo (/nuevo), REUSANDO las mismas reglas del asistente
 * actual (party-schemas + validateDocumentNumber) y alineada con lo que exige
 * `validateContractData` para poder GENERAR el contrato sin faltantes: cada
 * parte necesita documento, ciudad, correo y teléfono; el inmueble necesita
 * departamento y matrícula; el arriendo necesita fechas, duración y día de pago.
 * Devuelve un mensaje de error o null si el paso es válido.
 */

import { z } from "zod";
import { zPhoneCo, citySchema } from "@/features/contracts/party-schemas";
import { validateDocumentNumber } from "@/domain/colombia/document-validation";
import { fullNameError } from "@/domain/contracts/personName";
import type { DocumentType } from "@/domain/contracts/types";

// Regla única de nombre (nombre + apellido, solo letras): compartida con el
// servidor para que no se pueda burlar. Ver domain/contracts/personName.
const nameError = fullNameError;

function emailError(v: string): string | null {
  return z.string().email().safeParse((v || "").trim()).success ? null : "Correo electrónico inválido.";
}

function phoneError(v: string): string | null {
  const r = zPhoneCo.safeParse(v);
  return r.success ? null : (r.error.issues[0]?.message ?? "Teléfono inválido.");
}

function cityError(v: string): string | null {
  const r = citySchema.safeParse((v || "").trim());
  return r.success ? null : (r.error.issues[0]?.message ?? "Ciudad inválida.");
}

function addressError(v: string): string | null {
  const t = (v || "").trim();
  if (t.length < 5) return "Indica la dirección del inmueble (mínimo 5 caracteres).";
  if (!/^[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s.,#\-°º/]+$/.test(t)) return "La dirección tiene caracteres no válidos (evita emojis o símbolos).";
  if (!/[a-zA-Z]/.test(t)) return "La dirección debe incluir letras (ej. Calle 32 # 25-48).";
  return null;
}

function docTypeToDomain(t: string): DocumentType {
  return (t === "Pasaporte" ? "PASAPORTE" : t) as DocumentType;
}

function docError(type: string, number: string): string | null {
  const r = validateDocumentNumber(docTypeToDomain(type), number);
  return r.ok ? null : r.message;
}

const toNum = (v: string) => Number((v || "").replace(/[^\d]/g, "")) || 0;

/**
 * Ingreso de la persona frente al canon. BLOQUEANTE si el ingreso declarado es
 * INFERIOR al canon (no podría pagar el arriendo). El aviso de "≥2× sugerido"
 * (warning ámbar / verde) es solo orientación en la UI y no bloquea.
 */
function incomeError(canon: string, income: string, who: string): string | null {
  const rent = toNum(canon);
  const inc = toNum(income);
  if (inc <= 0) return `Indica el ingreso mensual ${who} (para evaluar solvencia).`;
  if (rent > 0 && inc < rent) return `El ingreso ${who} es inferior al canon. Corrígelo para continuar.`;
  return null;
}

export type Answers = {
  contractType: string;
  // Arrendador
  name: string; docType: string; docNumber: string; phone: string; email: string; ownerCity: string;
  acting: "" | "owner" | "proxy"; proxyOath: boolean;
  // Nombre del propietario que otorga el poder (solo si actúa como apoderado).
  poderdanteName: string;
  // Inmueble
  address: string; city: string; department: string;
  registry: string; propertyType: string; registrySkip: boolean;
  // Documento que soporta la propiedad del inmueble (reemplaza la matrícula):
  // el dueño elige el tipo y sube el archivo.
  propertyDocType: "" | "tradicion" | "servicios" | "predial" | "escritura" | "otro";
  // Juramento del dueño/apoderado: declara estar facultado para arrendar, se hace
  // responsable de la veracidad del soporte y exonera a ArriendoSeguro.
  propertyOath: boolean;
  canon: string; commercialValue: string; noCommercialValue: boolean;
  // Documentos que el dueño exige a cada parte (claves del catálogo requiredDocs).
  reqDocsTenant: string[]; reqDocsCodebtor: string[];
  // Términos del arriendo
  startDate: string; termMonths: string; paymentDay: string;
  // Inquilino
  tenantMode: "self" | "invite"; tenantName: string;
  tenantDocType: string; tenantDocNumber: string; tenantCity: string; tenantEmail: string; tenantPhone: string; tenantAuth: boolean; tenantIncome: string;
  // Codeudor
  hasCodebtor: "" | "yes" | "no"; codebtorName: string; codebtorMode: "self" | "invite" | "tenant";
  codebtorDocType: string; codebtorDocNumber: string; codebtorCity: string; codebtorEmail: string; codebtorPhone: string; codebtorAuth: boolean; codebtorIncome: string;
  // Servicios y cláusulas
  utilitiesParty: "" | "arrendatario" | "arrendador" | "compartido";
  adminParty: "" | "arrendatario" | "arrendador" | "no_aplica";
  // Política de notificaciones/comprobantes de pago (se refleja como cláusula
  // condicional en el contrato). Ver domain/contracts paymentSupportPolicy.
  paymentSupportPolicy: "" | "none" | "notifications" | "notifications_and_upload";
  clauses: string[]; clauseOther: string;
  // Documentos
  docMethod: "" | "self" | "whatsapp" | "email"; docPhone: string; docEmail: string;
};

/** Devuelve el error del paso actual (o null si es válido y se puede avanzar). */
export function validateStep(kind: string, a: Answers): string | null {
  switch (kind) {
    case "ctype":
      return a.contractType ? null : "Elige el tipo de contrato para continuar.";
    case "text":
      return nameError(a.name);
    case "doc":
      return docError(a.docType, a.docNumber);
    case "contact":
      return phoneError(a.phone) ?? emailError(a.email) ?? cityError(a.ownerCity);
    case "acting":
      if (a.acting === "") return "Indica si eres el dueño o actúas como apoderado.";
      if (a.acting === "proxy") {
        const gErr = nameError(a.poderdanteName);
        if (gErr) return `Nombre del propietario que te da el poder: ${gErr.toLowerCase()}`;
        if (!a.proxyOath) return "Como apoderado, acepta la declaración para poder continuar.";
      }
      return null;
    case "addr":
      return addressError(a.address) ?? cityError(a.city) ?? (a.department.trim().length < 3 ? "Indica el departamento del inmueble." : null);
    case "registry":
      if (!a.propertyType) return "Elige el tipo de inmueble (apartamento, casa, local…).";
      // El TIPO de documento y la CARGA del archivo son opcionales EN ESTE PASO:
      // se pueden saltar y subir más tarde (antes de generar). El archivo cuenta
      // como pendiente en la vista previa: no se puede generar sin él.
      // Juramento de facultad + exoneración (siempre exigido antes de avanzar).
      if (!a.propertyOath) return "Acepta la declaración de facultad y responsabilidad sobre el inmueble para continuar.";
      return null;
    case "reqdocs":
      // Opcional: el dueño puede no exigir documentos. Se puede continuar.
      return null;
    case "canon": {
      const n = Number((a.canon || "").replace(/[^\d]/g, ""));
      if (!(n > 0)) return "Indica el canon mensual (solo números, mayor a 0).";
      if (a.noCommercialValue) return null;
      const cv = Number((a.commercialValue || "").replace(/[^\d]/g, ""));
      if (cv > 0) {
        const cap = Math.round(cv * 0.01);
        if (n > cap) return `El canon supera el tope legal: máximo 1% del valor comercial ($${cap.toLocaleString("es-CO")}). Baja el canon o corrige el valor comercial.`;
        return null;
      }
      return "Indica el valor comercial del inmueble para validar el tope (Ley 820), o marca “No lo conozco”.";
    }
    case "lease": {
      if (!a.startDate) return "Selecciona la fecha de inicio del contrato.";
      const months = Number(a.termMonths);
      if (!Number.isInteger(months) || months <= 0) return "Indica la duración del contrato en meses (mayor a 0).";
      const day = Number(a.paymentDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) return "Indica el día de pago (entre 1 y 31).";
      return null;
    }
    case "tenant":
      // Ahora este paso elige el MODO primero. Si el dueño los ingresa, pedimos
      // el nombre aquí; por invitación no hace falta (la persona lo pone al llenar).
      if (a.tenantMode === "invite") return null;
      return nameError(a.tenantName);
    case "tenantfull":
      // Por invitación, la persona completa sus propios datos (con OTP + juramento
      // + evidencia); aquí no exigimos nada y se puede continuar.
      if (a.tenantMode === "invite") return null;
      return docError(a.tenantDocType, a.tenantDocNumber) ?? cityError(a.tenantCity) ?? emailError(a.tenantEmail) ?? phoneError(a.tenantPhone)
        ?? incomeError(a.canon, a.tenantIncome, "del arrendatario")
        ?? (a.tenantAuth ? null : "Confirma que tienes autorización del arrendatario para ingresar sus datos.");
    case "codebtor":
      // Este paso decide si hay codeudor y, si sí, QUIÉN ingresa sus datos. El
      // nombre y los datos se piden en el siguiente paso solo cuando el dueño los
      // ingresa (self); por invitación o gestión del inquilino no se piden aquí.
      if (a.hasCodebtor === "") return "Elige si el contrato tendrá codeudor.";
      return null;
    case "codebtorfull":
      // "invite": el codeudor completa por su enlace. "tenant": lo gestiona el
      // inquilino desde su propia invitación. En ambos casos el dueño continúa y
      // luego importa. Solo en "self" pedimos nombre + documento + contacto.
      if (a.codebtorMode === "invite" || a.codebtorMode === "tenant") return null;
      return nameError(a.codebtorName) ?? docError(a.codebtorDocType, a.codebtorDocNumber) ?? cityError(a.codebtorCity) ?? emailError(a.codebtorEmail) ?? phoneError(a.codebtorPhone)
        ?? incomeError(a.canon, a.codebtorIncome, "del codeudor")
        ?? (a.codebtorAuth ? null : "Confirma que tienes autorización del codeudor para ingresar sus datos.");
    case "credit":
      return null; // opcional: herramientas externas de verificación
    case "utils":
      if (!a.utilitiesParty) return "Indica quién paga los servicios públicos.";
      if (!a.adminParty) return "Indica quién paga la administración (o marca «No aplica»).";
      return null;
    case "clauses":
      if (a.clauses.includes("OTRA") && !a.clauseOther.trim()) return "Describe la cláusula “Otra”, o quítala de la selección.";
      return null;
    case "docs":
      if (a.docMethod === "") return "Elige cómo se cargarán los documentos del inquilino.";
      if (a.docMethod === "whatsapp") return phoneError(a.docPhone);
      if (a.docMethod === "email") return emailError(a.docEmail);
      return null;
    default:
      return null;
  }
}
