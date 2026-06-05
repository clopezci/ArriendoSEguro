import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availablePaymentYears,
  filterPaymentsForCertificate,
  summarizeCertificate,
  paymentsToCsv,
  renderPaymentsCertificateHtml,
  type CertifiablePayment,
} from "./paymentsCertificate";

const SAMPLE: CertifiablePayment[] = [
  { periodLabel: "Ene 2025", dueDate: "2025-01-05", paidDate: "2025-01-04", amountDue: 1000000, amountPaid: 1000000, paymentStatus: "reported_paid" },
  { periodLabel: "Feb 2025", dueDate: "2025-02-05", paidDate: "2025-02-06", amountDue: 1000000, amountPaid: 1000000, paymentStatus: "late" },
  { periodLabel: "Ene 2026", dueDate: "2026-01-05", paidDate: "2026-01-05", amountDue: 1100000, amountPaid: 1100000, paymentStatus: "reported_paid" },
  { periodLabel: "Mar 2025", dueDate: "2025-03-05", amountDue: 1000000, amountPaid: 0, paymentStatus: "pending" }, // no pagado
];

test("años disponibles solo de pagos con valor pagado, desc", () => {
  assert.deepEqual(availablePaymentYears(SAMPLE), [2026, 2025]);
});

test("filtra por año e ignora los no pagados", () => {
  const y2025 = filterPaymentsForCertificate(SAMPLE, 2025);
  assert.equal(y2025.length, 2);
  assert.deepEqual(y2025.map((p) => p.periodLabel), ["Ene 2025", "Feb 2025"]);
});

test("sin año incluye todos los pagados", () => {
  assert.equal(filterPaymentsForCertificate(SAMPLE).length, 3);
});

test("excluye pagos subidos por el inquilino aún no confirmados por el dueño", () => {
  const payments: CertifiablePayment[] = [
    { periodLabel: "Abr 2025", dueDate: "2025-04-05", paidDate: "2025-04-05", amountDue: 1000000, amountPaid: 1000000, paymentStatus: "reported_paid", uploadedByTenantLink: true, ownerConfirmed: false },
    { periodLabel: "May 2025", dueDate: "2025-05-05", paidDate: "2025-05-05", amountDue: 1000000, amountPaid: 1000000, paymentStatus: "reported_paid", uploadedByTenantLink: true, ownerConfirmed: true },
    { periodLabel: "Jun 2025", dueDate: "2025-06-05", paidDate: "2025-06-05", amountDue: 1000000, amountPaid: 1000000, paymentStatus: "reported_paid" }, // registrado directo
  ];
  const filtered = filterPaymentsForCertificate(payments, 2025);
  assert.deepEqual(filtered.map((p) => p.periodLabel), ["May 2025", "Jun 2025"]); // el de abril (sin confirmar) se excluye
});

test("resumen suma lo pagado", () => {
  const s = summarizeCertificate(filterPaymentsForCertificate(SAMPLE, 2025));
  assert.equal(s.count, 2);
  assert.equal(s.totalPaid, 2000000);
});

test("CSV tiene encabezado, BOM y escapa comas", () => {
  const csv = paymentsToCsv([
    { periodLabel: "Ene, 2025", dueDate: "2025-01-05", paidDate: "2025-01-04", amountDue: 1000000, amountPaid: 1000000, paymentStatus: "reported_paid", notes: 'pago "parcial"' },
  ]);
  assert.ok(csv.startsWith("﻿")); // BOM
  assert.ok(csv.includes('"Ene, 2025"')); // coma escapada
  assert.ok(csv.includes('"pago ""parcial"""')); // comillas escapadas
  assert.ok(csv.includes("Periodo,Vencimiento"));
});

test("certificado: título neutral, sin terminología tributaria", () => {
  const html = renderPaymentsCertificateHtml({
    contractId: "ct_1",
    propertyAddress: "Calle 1",
    landlordName: "A",
    tenantName: "B",
    year: 2025,
    payments: filterPaymentsForCertificate(SAMPLE, 2025),
    generatedAt: "2026-06-04T00:00:00.000Z",
  });
  assert.ok(html.includes("Certificado de pagos registrados"));
  assert.ok(/Total registrado/.test(html));
  // No debe mencionar terminología tributaria.
  assert.equal(/tribut|renta|DIAN|impuesto/i.test(html), false);
});

test("certificado vacío muestra aviso", () => {
  const html = renderPaymentsCertificateHtml({
    contractId: "ct_1",
    propertyAddress: "Calle 1",
    landlordName: "A",
    tenantName: "B",
    payments: [],
    generatedAt: "2026-06-04T00:00:00.000Z",
  });
  assert.ok(html.includes("Sin pagos registrados"));
});
