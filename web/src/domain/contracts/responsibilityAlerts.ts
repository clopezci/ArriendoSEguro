/**
 * "Constancia de alertas y responsabilidad": módulo PURO que, a partir de los
 * datos del contrato y del resultado de la validación de documentos, arma la
 * lista de puntos de atención que se le muestran al DUEÑO y al INQUILINO antes
 * de firmar, y que se congelan como anexo del expediente (evidencia).
 *
 * Tono: NUNCA acusa de fraude ni alarma. Deja claro, de forma suave, que
 * ArriendoSeguro ofrece herramientas de apoyo (validación asistida, juramentos)
 * pero que la verificación y la responsabilidad de la relación son de las partes.
 */

export type AlertSeverity = "info" | "warn" | "high";
export type AlertAudience = "owner" | "tenant" | "both";

export type ResponsibilitySignal = {
  id: string;
  severity: AlertSeverity;
  audience: AlertAudience;
  title: string;
  detail: string;
};

export type PropertyDocVerdict =
  | "match"
  | "mismatch"
  | "wrong_type"
  | "unreadable"
  | "skipped"
  | "none";

export type ResponsibilityInput = {
  actingAs: "owner" | "proxy";
  landlordName?: string;
  grantorName?: string;
  propertyAddress?: string;
  /** ¿Se adjuntó al menos un documento que soporte la propiedad? */
  hasPropertyDoc: boolean;
  /** Veredicto de la validación asistida del documento de propiedad. */
  propertyDocVerdict: PropertyDocVerdict;
  /** ¿La validación por IA estaba disponible al revisar? (si no, se aclara). */
  aiAvailable: boolean;
  /** Si actúa como apoderado, ¿se adjuntó el poder? */
  hasPoderDoc: boolean;
  /** Canon mensual (COP) e ingresos declarados, para el punto de solvencia. */
  canonCop?: number;
  tenantName?: string;
  tenantIncomeCop?: number;
  codebtorName?: string;
  codebtorIncomeCop?: number;
};

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Calcula las señales de responsabilidad a partir de los datos del contrato. */
export function computeResponsibilitySignals(input: ResponsibilityInput): ResponsibilitySignal[] {
  const signals: ResponsibilitySignal[] = [];
  const ownerLabel = input.actingAs === "proxy" ? "el apoderado del propietario" : "el arrendador";

  // 1) Titularidad de la propiedad.
  if (input.actingAs === "proxy") {
    if (!input.hasPoderDoc) {
      signals.push({
        id: "poder_missing",
        severity: "warn",
        audience: "both",
        title: "El arrendamiento lo gestiona un apoderado",
        detail:
          `Quien firma actúa como apoderado${input.grantorName ? ` de ${input.grantorName}` : " del propietario"} y ` +
          `aún no se adjuntó el poder. Recomendamos revisar el poder que faculta esta gestión.`,
      });
    } else {
      signals.push({
        id: "poder_present",
        severity: "info",
        audience: "both",
        title: "Gestión por apoderado con poder adjunto",
        detail:
          `El arrendamiento lo gestiona un apoderado${input.grantorName ? ` de ${input.grantorName}` : ""} y se adjuntó el poder. ` +
          `Verifiquen que el poder corresponde y está vigente.`,
      });
    }
  }

  if (!input.hasPropertyDoc) {
    signals.push({
      id: "property_doc_missing",
      severity: "warn",
      audience: "both",
      title: "No se adjuntó documento que soporte la propiedad",
      detail:
        `${cap(ownerLabel)} declaró, bajo juramento, ser el titular del inmueble` +
        `${input.propertyAddress ? ` ubicado en ${input.propertyAddress}` : ""}, pero no se cargó un documento que lo respalde ` +
        `(certificado de tradición, predial, escritura o recibo de servicios). La titularidad queda amparada por la declaración ` +
        `jurada. Si lo consideran necesario, verifiquen la titularidad antes de firmar.`,
    });
  } else if (input.propertyDocVerdict === "mismatch" || input.propertyDocVerdict === "wrong_type") {
    signals.push({
      id: "property_doc_mismatch",
      severity: "high",
      audience: "both",
      title: "El documento de propiedad requiere revisión",
      detail:
        `Se adjuntó un documento de propiedad, pero la revisión asistida no logró confirmar que coincida con los datos ` +
        `declarados${input.propertyDocVerdict === "wrong_type" ? " (o no parece ser del tipo esperado)" : ""}. ` +
        `Es orientativo y no vinculante; recomendamos revisarlo con calma antes de firmar.`,
    });
  } else if (input.propertyDocVerdict === "match") {
    signals.push({
      id: "property_doc_match",
      severity: "info",
      audience: "both",
      title: "Documento de propiedad adjunto y coincide",
      detail:
        `Se adjuntó el documento de propiedad y la revisión asistida encontró coincidencia con los datos declarados. ` +
        `Es un apoyo orientativo; la verificación final es de las partes.`,
    });
  } else {
    // adjunto pero validación no concluyente (skipped/unreadable) o IA apagada.
    signals.push({
      id: "property_doc_unverified",
      severity: "info",
      audience: "both",
      title: "Documento de propiedad adjunto (sin validación automática concluyente)",
      detail:
        `Se adjuntó el documento de propiedad. ${input.aiAvailable
          ? "La revisión asistida no fue concluyente (por ejemplo, foto poco legible)."
          : "La revisión automática no estaba disponible en ese momento."} ` +
        `Queda respaldado por la declaración jurada; recomendamos que las partes lo revisen.`,
    });
  }

  // 2) Solvencia declarada vs canon (apoyo al dueño).
  const canon = num(input.canonCop);
  if (canon > 0) {
    const tIncome = num(input.tenantIncomeCop);
    if (tIncome > 0 && tIncome < canon) {
      signals.push({
        id: "tenant_income_below_canon",
        severity: "warn",
        audience: "owner",
        title: "Ingreso declarado del arrendatario menor al canon",
        detail:
          `${input.tenantName ? input.tenantName : "El arrendatario"} declaró un ingreso mensual inferior al canon. ` +
          `Valida los soportes de ingresos antes de firmar.`,
      });
    } else if (tIncome > 0 && tIncome < canon * 2) {
      signals.push({
        id: "tenant_income_tight",
        severity: "info",
        audience: "owner",
        title: "Ingreso declarado del arrendatario ajustado",
        detail:
          `El ingreso declarado del arrendatario es menor a dos veces el canon. Es una guía habitual; valida los soportes.`,
      });
    }
    const cIncome = num(input.codebtorIncomeCop);
    if (cIncome > 0 && cIncome < canon) {
      signals.push({
        id: "codebtor_income_below_canon",
        severity: "warn",
        audience: "owner",
        title: "Ingreso declarado del codeudor menor al canon",
        detail:
          `${input.codebtorName ? input.codebtorName : "El codeudor"} declaró un ingreso mensual inferior al canon. ` +
          `Valida los soportes antes de firmar.`,
      });
    }
  }

  return signals;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Señales visibles para una audiencia (dueño o inquilino). */
export function signalsForAudience(signals: ResponsibilitySignal[], who: "owner" | "tenant"): ResponsibilitySignal[] {
  return signals.filter((s) => s.audience === "both" || s.audience === who);
}

/** Texto introductorio (suave) por audiencia. */
export function responsibilityIntro(who: "owner" | "tenant"): string {
  if (who === "owner") {
    return (
      "Antes de firmar, revisa estos puntos. ArriendoSeguro te da herramientas de apoyo (validación asistida de " +
      "documentos y declaraciones juramentadas), pero la verificación de la información y de los documentos es " +
      "responsabilidad de las partes. Esta constancia queda archivada en el expediente."
    );
  }
  return (
    "Para tu tranquilidad, ten en cuenta estos puntos antes de firmar. ArriendoSeguro facilita la formalización y " +
    "ofrece herramientas de apoyo, pero no garantiza ni sustituye la verificación entre las partes; la relación de " +
    "arrendamiento y su cumplimiento son responsabilidad de quienes la celebran. Esta constancia queda en el expediente."
  );
}

/**
 * Arma el HTML del anexo (evidencia inmutable) con TODAS las señales, para ambas
 * audiencias, y la constancia de responsabilidad.
 */
export function renderResponsibilityAlertsAnnexHtml(input: {
  contractId: string;
  contractVersionId: string;
  propertyAddress?: string;
  landlordName?: string;
  tenantName?: string;
  generatedAtIso: string;
  signals: ResponsibilitySignal[];
}): string {
  const sevLabel: Record<AlertSeverity, string> = { info: "Informativo", warn: "Atención", high: "Revisar" };
  const rows = input.signals
    .map(
      (s) => `
      <tr>
        <td><strong>${sevLabel[s.severity]}</strong></td>
        <td>${audienceLabel(s.audience)}</td>
        <td><strong>${escapeHtml(s.title)}</strong><br/>${escapeHtml(s.detail)}</td>
      </tr>`,
    )
    .join("");

  return `
    <article>
      <h1>Anexo — Constancia de alertas y responsabilidad</h1>
      <p>Expediente (contrato): ${escapeHtml(input.contractId)}</p>
      <p>Versión contractual: ${escapeHtml(input.contractVersionId)}</p>
      <p>Fecha de generación (UTC): ${escapeHtml(input.generatedAtIso)}</p>
      ${input.landlordName ? `<p>Arrendador: ${escapeHtml(input.landlordName)}</p>` : ""}
      ${input.tenantName ? `<p>Arrendatario: ${escapeHtml(input.tenantName)}</p>` : ""}
      ${input.propertyAddress ? `<p>Inmueble: ${escapeHtml(input.propertyAddress)}</p>` : ""}
      <p><strong>Constancia:</strong> ArriendoSeguro ofrece herramientas de apoyo (validación asistida de documentos y
      declaraciones juramentadas), de carácter orientativo y no vinculante. La verificación de la información y de los
      documentos, así como el cumplimiento del contrato, son responsabilidad de las partes. Las partes declararon conocer
      los siguientes puntos de atención antes de firmar.</p>
      ${input.signals.length === 0
        ? "<p>No se identificaron puntos de atención adicionales.</p>"
        : `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">
             <thead><tr><th>Nivel</th><th>Dirigido a</th><th>Punto de atención</th></tr></thead>
             <tbody>${rows}</tbody>
           </table>`}
      <p style="font-size:12px;color:#475569">Este anexo se conserva como evidencia. No constituye una acusación ni un
      dictamen; refleja lo observado por las herramientas de apoyo y lo declarado por las partes al momento de firmar.</p>
    </article>
  `;
}

function audienceLabel(a: AlertAudience): string {
  return a === "owner" ? "Arrendador" : a === "tenant" ? "Arrendatario" : "Ambas partes";
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
