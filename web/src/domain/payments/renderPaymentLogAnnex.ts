import { generateDocumentHash } from "@/domain/contracts/hash";
import type { PaymentLog } from "./types";

export function renderPaymentLogAnnex(input: {
  contractId: string;
  contractVersionId: string;
  propertyAddress: string;
  landlordName: string;
  tenantName: string;
  payments: PaymentLog[];
}) {
  const rows = input.payments
    .map(
      (p) => `
      <tr>
        <td>${p.periodLabel}</td>
        <td>${p.dueDate}</td>
        <td>${p.paidDate ?? "-"}</td>
        <td>${p.amountDue.toLocaleString("es-CO")}</td>
        <td>${p.amountPaid.toLocaleString("es-CO")}</td>
        <td>${p.paymentStatus}</td>
        <td>${p.notes ?? "-"}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <article>
      <h1>Anexo No. 3 - Registro de pagos</h1>
      <p>Contrato: ${input.contractId}</p>
      <p>Versión contractual: ${input.contractVersionId}</p>
      <p>Inmueble: ${input.propertyAddress}</p>
      <p>Arrendador: ${input.landlordName}</p>
      <p>Arrendatario: ${input.tenantName}</p>
      <p>Fecha de generación: ${new Date().toLocaleString("es-CO")}</p>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Periodo</th>
            <th>Vencimiento</th>
            <th>Fecha pagada</th>
            <th>Valor esperado</th>
            <th>Valor pagado</th>
            <th>Estado</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="7">Sin pagos registrados.</td></tr>`}</tbody>
      </table>
    </article>
  `;
  return { html, hash: generateDocumentHash(html) };
}

