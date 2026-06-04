/**
 * Exportación discreta de pagos: CSV y "Certificado de pagos registrados".
 *
 * Es un documento **informativo** de los pagos que la persona registró en la
 * plataforma. Deliberadamente **neutral**: no menciona impuestos, renta ni
 * entidades; solo lista y suma lo registrado. Si no hay pagos registrados,
 * el documento sale vacío con un aviso. Módulo **puro** (sin red ni PDF).
 */

export interface CertifiablePayment {
  periodLabel: string;
  dueDate: string;
  paidDate?: string;
  amountDue: number;
  amountPaid: number;
  paymentMethod?: string;
  paymentStatus: string;
  notes?: string;
}

function yearOf(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})/.exec(iso.trim());
  return m ? Number(m[1]) : null;
}

/** Año de referencia del pago: el de la fecha de pago; si falta, el de vencimiento. */
export function paymentYear(p: CertifiablePayment): number | null {
  return yearOf(p.paidDate) ?? yearOf(p.dueDate);
}

/** Años con pagos registrados (con algo pagado), de más reciente a más antiguo. */
export function availablePaymentYears(payments: CertifiablePayment[]): number[] {
  const set = new Set<number>();
  for (const p of payments) {
    if (p.amountPaid > 0) {
      const y = paymentYear(p);
      if (y != null) set.add(y);
    }
  }
  return [...set].sort((a, b) => b - a);
}

/**
 * Pagos a incluir en el certificado: los que tienen algún valor pagado
 * (registrados como pagados), filtrados por año si se indica. Ordenados por
 * fecha.
 */
export function filterPaymentsForCertificate(
  payments: CertifiablePayment[],
  year?: number,
): CertifiablePayment[] {
  return payments
    .filter((p) => p.amountPaid > 0 && (year == null || paymentYear(p) === year))
    .sort((a, b) => (a.paidDate ?? a.dueDate ?? "").localeCompare(b.paidDate ?? b.dueDate ?? ""));
}

export interface CertificateSummary {
  count: number;
  totalPaid: number;
  totalDue: number;
}

export function summarizeCertificate(payments: CertifiablePayment[]): CertificateSummary {
  return payments.reduce<CertificateSummary>(
    (acc, p) => ({
      count: acc.count + 1,
      totalPaid: acc.totalPaid + (Number(p.amountPaid) || 0),
      totalDue: acc.totalDue + (Number(p.amountDue) || 0),
    }),
    { count: 0, totalPaid: 0, totalDue: 0 },
  );
}

function csvCell(value: string | number | undefined | null): string {
  const s = value == null ? "" : String(value);
  // Escapa comillas y envuelve si contiene separador, comillas o saltos de línea.
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CSV_HEADERS = [
  "Periodo",
  "Vencimiento",
  "Fecha de pago",
  "Valor esperado",
  "Valor pagado",
  "Estado",
  "Metodo",
  "Observaciones",
];

/** CSV (separado por coma) de los pagos. Incluye BOM para Excel en español. */
export function paymentsToCsv(payments: CertifiablePayment[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const p of payments) {
    lines.push(
      [
        csvCell(p.periodLabel),
        csvCell(p.dueDate),
        csvCell(p.paidDate ?? ""),
        csvCell(p.amountDue),
        csvCell(p.amountPaid),
        csvCell(p.paymentStatus),
        csvCell(p.paymentMethod ?? ""),
        csvCell(p.notes ?? ""),
      ].join(","),
    );
  }
  return `﻿${lines.join("\r\n")}`;
}

function cop(n: number): string {
  return `$${(Number(n) || 0).toLocaleString("es-CO")}`;
}

/** HTML neutral del "Certificado de pagos registrados" para generar el PDF. */
export function renderPaymentsCertificateHtml(input: {
  contractId: string;
  propertyAddress: string;
  landlordName: string;
  tenantName: string;
  year?: number;
  payments: CertifiablePayment[];
  generatedAt: string;
}): string {
  const summary = summarizeCertificate(input.payments);
  const periodo = input.year ? `año ${input.year}` : "todos los periodos registrados";
  const rows = input.payments
    .map(
      (p) => `
      <tr>
        <td>${p.periodLabel}</td>
        <td>${p.dueDate}</td>
        <td>${p.paidDate ?? "-"}</td>
        <td style="text-align:right;">${cop(p.amountPaid)}</td>
        <td>${p.paymentStatus}</td>
        <td>${p.notes ?? "-"}</td>
      </tr>`,
    )
    .join("");

  return `
    <article>
      <h1>Certificado de pagos registrados</h1>
      <p>Documento informativo de los pagos registrados en ArriendoSeguro para el contrato indicado. Periodo: ${periodo}.</p>
      <p>Contrato: ${input.contractId}</p>
      <p>Inmueble: ${input.propertyAddress}</p>
      <p>Arrendador: ${input.landlordName}</p>
      <p>Arrendatario: ${input.tenantName}</p>
      <p>Fecha de generacion: ${new Date(input.generatedAt).toLocaleString("es-CO")}</p>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Periodo</th>
            <th>Vencimiento</th>
            <th>Fecha de pago</th>
            <th>Valor pagado</th>
            <th>Estado</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">Sin pagos registrados en este periodo.</td></tr>`}</tbody>
      </table>
      <p><strong>Total registrado:</strong> ${cop(summary.totalPaid)} en ${summary.count} pago(s).</p>
      <p style="font-size:11px;color:#475569;">
        Este es un documento informativo generado a partir de lo que las partes registraron en la plataforma. No
        constituye un certificado oficial ni reemplaza la asesoria de un contador. Verifica los valores antes de usarlo.
      </p>
    </article>
  `.trim();
}
