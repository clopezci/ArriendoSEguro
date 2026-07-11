import { test } from "node:test";
import assert from "node:assert/strict";
import { repeatCodebtorBlock, resolveCodebtors, codebtorCount } from "./codebtorBlocks";
import { buildContractVariables } from "./contractVariables";
import { renderResidentialLeaseContract } from "./renderResidentialLeaseContract";
import type { PersonParty, ResidentialLeaseContractInput } from "./types";

function person(n: string): PersonParty {
  return {
    fullName: `Persona ${n}`,
    documentType: "CC",
    documentNumber: `100${n}`,
    city: "Bogotá",
    email: `p${n}@x.com`,
    phone: "3000000000",
    notificationAddress: `Calle ${n}`,
  };
}

function baseInput(over: Partial<ResidentialLeaseContractInput>): ResidentialLeaseContractInput {
  return {
    landlord: person("L"),
    tenant: person("T"),
    hasSolidaryCoDebtor: false,
    property: {
      address: "Calle 1",
      city: "Bogotá",
      department: "Cundinamarca",
      type: "Apartamento",
      registryNumber: "50C-123",
      commercialValue: 200_000_000,
      legalRentCap: 2_000_000,
    },
    lease: {
      monthlyRent: 1_500_000,
      monthlyRentText: "un millón quinientos mil pesos",
      paymentDueDay: 5,
      paymentMethod: "transferencia bancaria",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      termMonths: 12,
      latePaymentMonthsThreshold: 2,
    },
    utilities: { responsibleParty: "arrendatario", details: "agua, luz", adminFeesDetails: "n/a" },
    contractVersion: "AS-LEASE-MVP-2026.1",
    generatedAt: "2026-06-04T00:00:00.000Z",
    ...over,
  };
}

test("repeatCodebtorBlock: 0 → vacío, 1 → igual, 2 → indexa el segundo", () => {
  assert.equal(repeatCodebtorBlock("[NOMBRE_CODEUDOR]", 0), "");
  assert.equal(repeatCodebtorBlock("[NOMBRE_CODEUDOR]", 1), "[NOMBRE_CODEUDOR]");
  assert.equal(repeatCodebtorBlock("[NOMBRE_CODEUDOR]", 2), "[NOMBRE_CODEUDOR]\n[NOMBRE_CODEUDOR_2]");
});

test("resolveCodebtors prioriza la lista; cae al singular", () => {
  assert.equal(codebtorCount(baseInput({})), 0);
  assert.equal(codebtorCount(baseInput({ hasSolidaryCoDebtor: true, solidaryCoDebtor: person("C") })), 1);
  const multi = baseInput({ solidaryCoDebtors: [person("A"), person("B")] });
  assert.equal(resolveCodebtors(multi).length, 2);
});

test("buildContractVariables llena claves base y sufijadas", () => {
  const vars = buildContractVariables(baseInput({ solidaryCoDebtors: [person("A"), person("B")] }));
  assert.equal(vars.NOMBRE_CODEUDOR, "Persona A");
  assert.equal(vars.NOMBRE_CODEUDOR_2, "Persona B");
  assert.equal(vars.DOCUMENTO_CODEUDOR_2, "CC 100B");
});

test("un solo codeudor (singular) genera variables idénticas a hoy", () => {
  const vars = buildContractVariables(baseInput({ hasSolidaryCoDebtor: true, solidaryCoDebtor: person("C") }));
  assert.equal(vars.NOMBRE_CODEUDOR, "Persona C");
  assert.equal(vars.NOMBRE_CODEUDOR_2, undefined); // no hay segundo
});

test("render incluye a TODOS los codeudores en el HTML", () => {
  const out = renderResidentialLeaseContract(baseInput({ solidaryCoDebtors: [person("Uno"), person("Dos")] }));
  assert.ok(out.html.includes("Persona Uno"));
  assert.ok(out.html.includes("Persona Dos"));
});

test("render sin codeudor no deja placeholders de codeudor sueltos", () => {
  const out = renderResidentialLeaseContract(baseInput({}));
  // No deben quedar placeholders sin reemplazar (ej. [NOMBRE_CODEUDOR], y en
  // general ningún token [..._CODEUDOR...]) ni condicionales sin resolver.
  assert.equal(/\[[^\]]*CODEUDOR[^\]]*\]/.test(out.html), false);
  // No debe aparecer la SECCIÓN dedicada del codeudor (comparecencia/cláusula/
  // notificación/firma). Nota: la frase "cuando aplique, EL CODEUDOR SOLIDARIO"
  // sí puede aparecer legítimamente en cláusulas generales (juramento, datos,
  // reputación), por eso no se prohíbe la frase suelta.
  assert.equal(out.html.includes("CLÁUSULA DE CODEUDOR SOLIDARIO"), false);
  assert.equal(out.html.includes("EL CODEUDOR SOLIDARIO:"), false); // encabezado de notificación
});
