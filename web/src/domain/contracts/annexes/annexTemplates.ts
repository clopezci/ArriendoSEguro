import type { ContractAnnexType } from "./types";

const PLACEHOLDER = "Este anexo se generará cuando el módulo correspondiente esté completado.";

export const ANNEX_TITLES: Record<ContractAnnexType, string> = {
  initial_inventory: "Anexo No. 1 - Inventario inicial del inmueble",
  initial_delivery_act: "Anexo No. 2 - Acta de entrega inicial",
  payment_log: "Anexo No. 3 - Registro de pagos",
  closing_act: "Anexo No. 4 - Acta de cierre",
  electronic_signature_evidence: "Anexo No. 5 - Evidencia de firma electrónica",
  notarial_authentication: "Anexo — Copia autenticada en notaría (opcional)",
  data_processing_authorizations: "Anexo No. 6 - Autorizaciones de tratamiento de datos",
  structured_evaluation: "Anexo No. 7 - Evaluación estructurada",
  responsibility_alerts: "Anexo — Constancia de alertas y responsabilidad",
};

export const ANNEX_PLACEHOLDER_HTML: Partial<Record<ContractAnnexType, string>> = {
  initial_inventory: `
    <article>
      <h1>${ANNEX_TITLES.initial_inventory}</h1>
      <p>${PLACEHOLDER}</p>
    </article>
  `,
  initial_delivery_act: `
    <article>
      <h1>${ANNEX_TITLES.initial_delivery_act}</h1>
      <p>${PLACEHOLDER}</p>
    </article>
  `,
  electronic_signature_evidence: `
    <article>
      <h1>${ANNEX_TITLES.electronic_signature_evidence}</h1>
      <p>${PLACEHOLDER}</p>
    </article>
  `,
};

