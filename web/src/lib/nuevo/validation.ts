/**
 * Validación del flujo nuevo (/nuevo), REUSANDO las mismas reglas del asistente
 * actual (party-schemas + validateDocumentNumber). No inventa reglas nuevas: el
 * teléfono son 10 dígitos, el documento se valida por tipo (incluye dígito de
 * verificación del NIT), el correo debe ser válido, etc. Devuelve un mensaje de
 * error o null si el campo es válido.
 */

import { z } from "zod";
import { zPhoneCo, citySchema } from "@/features/contracts/party-schemas";
import { validateDocumentNumber } from "@/domain/colombia/document-validation";
import type { DocumentType } from "@/domain/contracts/types";

const NAME_RE = /^[A-Za-zÀ-ÿñÑ][A-Za-zÀ-ÿñÑ\s.'-]{4,}$/;

function nameError(v: string): string | null {
  const t = (v || "").trim();
  if (t.length < 5) return "Indica el nombre completo (mínimo 5 caracteres).";
  if (t.length > 120) return "El nombre es demasiado largo.";
  if (!NAME_RE.test(t)) return "El nombre solo debe llevar letras (sin números).";
  return null;
}

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
  // Solo letras, números, espacios y signos típicos de dirección; rechaza emojis y símbolos raros.
  if (!/^[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s.,#\-°º/]+$/.test(t)) return "La dirección tiene caracteres no válidos (evita emojis o símbolos).";
  if (!/[a-zA-Z]/.test(t)) return "La dirección debe incluir letras (ej. Calle 32 # 25-48).";
  return null;
}

function docTypeToDomain(t: string): DocumentType {
  return (t === "Pasaporte" ? "PASAPORTE" : t) as DocumentType;
}

export type Answers = {
  contractType: string; // "VIVIENDA_URBANA" (único habilitado hoy)
  name: string; docType: string; docNumber: string; phone: string; email: string;
  acting: "" | "owner" | "proxy"; proxyOath: boolean; // calidad: dueño o apoderado
  address: string; city: string;
  registry: string; propertyType: string; registrySkip: boolean; // matrícula (saltable) + tipo
  canon: string; commercialValue: string; noCommercialValue: boolean; // canon + tope legal (Ley 820)
  tenantMode: "self" | "invite"; tenantName: string;
  hasCodebtor: "" | "yes" | "no"; codebtorName: string;
  utilitiesParty: "" | "arrendatario" | "arrendador" | "mixto"; // servicios públicos
  clauses: string[]; clauseOther: string; // cláusulas especiales (catálogo + "Otra")
  docMethod: "" | "self" | "whatsapp" | "email"; docPhone: string; docEmail: string;
};

/** Devuelve el error del paso actual (o null si es válido y se puede avanzar). */
export function validateStep(kind: string, a: Answers): string | null {
  switch (kind) {
    case "ctype":
      return a.contractType ? null : "Elige el tipo de contrato para continuar.";
    case "acting":
      if (a.acting === "") return "Indica si eres el dueño o actúas como apoderado.";
      if (a.acting === "proxy" && !a.proxyOath)
        return "Como apoderado, acepta la declaración para poder continuar.";
      return null;
    case "registry":
      if (!a.propertyType) return "Elige el tipo de inmueble (apartamento, casa, local…).";
      if (!a.registrySkip && a.registry.trim().length < 2)
        return "Escribe la matrícula inmobiliaria, o marca “No la tengo ahora”.";
      return null;
    case "text":
      return nameError(a.name);
    case "doc": {
      const r = validateDocumentNumber(docTypeToDomain(a.docType), a.docNumber);
      return r.ok ? null : r.message;
    }
    case "contact":
      return phoneError(a.phone) ?? emailError(a.email);
    case "addr":
      return addressError(a.address) ?? cityError(a.city);
    case "canon": {
      const n = Number((a.canon || "").replace(/[^\d]/g, ""));
      if (!(n > 0)) return "Indica el canon mensual (solo números, mayor a 0).";
      if (a.noCommercialValue) return null; // aceptó seguir sin validar el tope
      const cv = Number((a.commercialValue || "").replace(/[^\d]/g, ""));
      if (cv > 0) {
        // Tope legal: el canon no puede exceder el 1% del valor comercial (Ley 820, art. 18).
        const cap = Math.round(cv * 0.01);
        if (n > cap)
          return `El canon supera el tope legal: máximo 1% del valor comercial ($${cap.toLocaleString("es-CO")}). Baja el canon o corrige el valor comercial.`;
        return null;
      }
      return "Indica el valor comercial del inmueble para validar el tope (Ley 820), o marca “No lo conozco”.";
    }
    case "utils":
      return a.utilitiesParty ? null : "Indica quién paga los servicios públicos.";
    case "clauses":
      if (a.clauses.includes("OTRA") && !a.clauseOther.trim())
        return "Describe la cláusula “Otra”, o quítala de la selección.";
      return null; // las cláusulas son opcionales
    case "tenant":
      return nameError(a.tenantName);
    case "codebtor":
      if (a.hasCodebtor === "") return "Elige si el contrato tendrá codeudor.";
      if (a.hasCodebtor === "yes") return nameError(a.codebtorName);
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
