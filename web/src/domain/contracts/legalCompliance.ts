/**
 * Semáforo legal / "Sello de cumplimiento Ley 820".
 *
 * Distingue dos naturalezas de verificación, sin mezclarlas:
 *
 * 1. **Validaciones en vivo** — sobre datos que el usuario digita y puede
 *    equivocar: canon vs. tope del 1% (Art. 18/Ley 820) y garantía de servicios
 *    ≤ suma de 2 períodos (Art. 15). Devuelven `pass` / `fail` / `warn`.
 * 2. **Cumplimiento por diseño** — garantías estructurales del producto: el
 *    flujo de vivienda urbana NO permite pactar depósito en dinero (Art. 16),
 *    el reajuste queda limitado al IPC (Art. 20), la mora mínima es 2 meses
 *    (Art. 22) y la firma tiene respaldo de la Ley 527. No son "detecciones":
 *    se muestran como prueba visible de que el contrato cumple porque está
 *    construido para cumplir.
 *
 * Módulo **puro** (sin React ni red) para reusarlo en componentes y tests.
 */

import { calculateLegalMonthlyRentCap } from "@/lib/domain/rent-law";

export type ComplianceStatus = "pass" | "fail" | "warn" | "info";

export interface ComplianceCheck {
  id: string;
  label: string;
  status: ComplianceStatus;
  detail: string;
  legalRef: string;
}

export interface ComplianceInput {
  property?: {
    commercialValue?: number;
    legalRentCap?: number;
    monthlyRentProposed?: number;
    commercialValueUnknown?: boolean;
  };
  lease?: {
    monthlyRent?: number;
    latePaymentMonthsThreshold?: number;
  };
  utilityServicesGuarantee?: {
    enabled?: boolean;
    acceptedAt?: string;
    agreedAmountCop?: number;
    maxAllowedCop?: number;
  };
  /** IPC vigente (%) para mostrar en el sello del reajuste. */
  ipcPercent?: number;
}

function copValue(n: number | undefined): number {
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0;
}

/** Canon vs. tope del 1% del valor comercial (Ley 820, art. 18). */
export function evaluateRentCapCompliance(input: ComplianceInput): ComplianceCheck {
  const base = {
    id: "rent_cap",
    label: "Canon dentro del tope legal (1% del valor comercial)",
    legalRef: "Ley 820 de 2003, art. 18",
  };
  const valueUnknown = Boolean(input.property?.commercialValueUnknown);
  const rent = copValue(input.lease?.monthlyRent ?? input.property?.monthlyRentProposed);
  const commercialValue = copValue(input.property?.commercialValue);
  const cap =
    commercialValue > 0
      ? calculateLegalMonthlyRentCap({ commercialValue }).cap
      : copValue(input.property?.legalRentCap);

  if (valueUnknown) {
    return {
      ...base,
      status: "info",
      detail:
        "El arrendador declaró no conocer el valor comercial y aceptó la responsabilidad de no superar el 1%. La verificación queda bajo su declaración.",
    };
  }
  if (cap <= 0 || rent <= 0) {
    return {
      ...base,
      status: "warn",
      detail: "Faltan datos (valor comercial o canon) para verificar el tope del 1%.",
    };
  }
  if (rent > cap) {
    return {
      ...base,
      status: "fail",
      detail: `El canon ($${rent.toLocaleString("es-CO")}) supera el tope del 1% ($${cap.toLocaleString("es-CO")}). Ajusta el valor comercial o el canon.`,
    };
  }
  return {
    ...base,
    status: "pass",
    detail: `El canon ($${rent.toLocaleString("es-CO")}) está dentro del tope del 1% ($${cap.toLocaleString("es-CO")}).`,
  };
}

/** Garantía de servicios públicos: única permitida y ≤ 2 períodos (Art. 15). */
export function evaluateUtilityGuaranteeCompliance(input: ComplianceInput): ComplianceCheck {
  const base = {
    id: "utility_guarantee",
    label: "Garantía limitada a servicios públicos (única permitida)",
    legalRef: "Ley 820 de 2003, art. 15",
  };
  const g = input.utilityServicesGuarantee;
  if (!g?.enabled) {
    return {
      ...base,
      status: "info",
      detail:
        "No incluiste garantía. Es opcional; si la usas, es exclusiva para servicios públicos (no es un depósito).",
    };
  }
  const agreed = copValue(g.agreedAmountCop);
  const max = copValue(g.maxAllowedCop);
  if (max > 0 && agreed > max) {
    return {
      ...base,
      status: "fail",
      detail: `La garantía ($${agreed.toLocaleString("es-CO")}) supera el máximo legal de $${max.toLocaleString("es-CO")} (suma de 2 períodos).`,
    };
  }
  if (!g.acceptedAt) {
    return {
      ...base,
      status: "warn",
      detail: "La garantía está activada pero falta aceptarla y registrarla en el paso de Servicios.",
    };
  }
  return {
    ...base,
    status: "pass",
    detail: `Garantía de $${agreed.toLocaleString("es-CO")} dentro del máximo legal, registrada con constancia.`,
  };
}

/** Depósito en dinero prohibido: cumplimiento por diseño (Art. 16). */
export function evaluateDepositCompliance(): ComplianceCheck {
  return {
    id: "no_deposit",
    label: "Sin depósito en dinero (prohibido por ley)",
    status: "pass",
    detail:
      "Este flujo de vivienda urbana no permite pactar depósito en dinero ni cuota de administración como garantía: la ley lo prohíbe expresamente.",
    legalRef: "Ley 820 de 2003, art. 16",
  };
}

/** Reajuste anual limitado al IPC: cumplimiento por diseño (Art. 20). */
export function evaluateIpcCompliance(input: ComplianceInput): ComplianceCheck {
  const pct = Number.isFinite(input.ipcPercent) ? `${input.ipcPercent}%` : "el IPC del año anterior";
  return {
    id: "ipc_cap",
    label: "Reajuste anual limitado al IPC",
    status: "pass",
    detail: `El contrato limita el reajuste anual del canon al IPC certificado por el DANE (${pct}). No permite incrementos por encima de ese tope.`,
    legalRef: "Ley 820 de 2003, art. 20",
  };
}

/** Mora mínima de 2 meses antes de exigir restitución (Art. 22). */
export function evaluateLatePaymentCompliance(input: ComplianceInput): ComplianceCheck {
  const base = {
    id: "late_payment",
    label: "Umbral de mora conforme a la ley (mínimo 2 meses)",
    legalRef: "Ley 820 de 2003, art. 22",
  };
  const threshold = Number(input.lease?.latePaymentMonthsThreshold ?? 0);
  if (threshold >= 2) {
    return {
      ...base,
      status: "pass",
      detail: `El contrato exige al menos ${threshold} meses de mora antes de iniciar gestiones de terminación.`,
    };
  }
  return {
    ...base,
    status: "warn",
    detail: "El umbral de mora debe ser de al menos 2 meses. Revisa el paso de Términos.",
  };
}

/** Firma electrónica con respaldo legal: cumplimiento por diseño (Ley 527). */
export function evaluateSignatureCompliance(): ComplianceCheck {
  return {
    id: "esignature",
    label: "Firma electrónica con respaldo legal",
    status: "info",
    detail:
      "La firma se realiza con evidencia (token, OTP por correo, registro de IP y fecha), válida como firma electrónica.",
    legalRef: "Ley 527 de 1999 y Decreto 2364 de 2012",
  };
}

export function evaluateLegalCompliance(input: ComplianceInput): ComplianceCheck[] {
  return [
    evaluateRentCapCompliance(input),
    evaluateDepositCompliance(),
    evaluateUtilityGuaranteeCompliance(input),
    evaluateIpcCompliance(input),
    evaluateLatePaymentCompliance(input),
    evaluateSignatureCompliance(),
  ];
}

export interface ComplianceSummary {
  overall: "pass" | "fail" | "warn";
  failCount: number;
  warnCount: number;
  passCount: number;
}

/**
 * Resume el conjunto: `fail` si hay algún bloqueante, `warn` si hay pendientes,
 * `pass` si todo lo verificable cumple. Los `info` no degradan el resultado.
 */
export function summarizeCompliance(checks: ComplianceCheck[]): ComplianceSummary {
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const passCount = checks.filter((c) => c.status === "pass").length;
  const overall = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";
  return { overall, failCount, warnCount, passCount };
}
