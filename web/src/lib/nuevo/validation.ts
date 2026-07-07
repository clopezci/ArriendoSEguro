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

function docTypeToDomain(t: string): DocumentType {
  return (t === "Pasaporte" ? "PASAPORTE" : t) as DocumentType;
}

export type Answers = {
  name: string; docType: string; docNumber: string; phone: string; email: string;
  address: string; city: string; canon: string;
  tenantMode: "self" | "invite"; tenantName: string;
  hasCodebtor: "" | "yes" | "no"; codebtorName: string;
  docMethod: "" | "self" | "whatsapp" | "email"; docPhone: string; docEmail: string;
};

/** Devuelve el error del paso actual (o null si es válido y se puede avanzar). */
export function validateStep(kind: string, a: Answers): string | null {
  switch (kind) {
    case "text":
      return nameError(a.name);
    case "doc": {
      const r = validateDocumentNumber(docTypeToDomain(a.docType), a.docNumber);
      return r.ok ? null : r.message;
    }
    case "contact":
      return phoneError(a.phone) ?? emailError(a.email);
    case "addr":
      return (a.address || "").trim().length < 4 ? "Indica la dirección del inmueble (mínimo 4 caracteres)." : cityError(a.city);
    case "canon": {
      const n = Number((a.canon || "").replace(/[^\d]/g, ""));
      return n > 0 ? null : "Indica el canon mensual (solo números, mayor a 0).";
    }
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
