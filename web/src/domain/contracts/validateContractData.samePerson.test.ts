import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicatePartyIssues } from "./validateContractData";

const SAME_PERSON = "no pueden ser la misma persona";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P = (name: string, doc: string): any => ({ fullName: name, documentType: "CC", documentNumber: doc });

test("inquilino y codeudor con el MISMO documento (aun con formato distinto) → error", () => {
  const out = duplicatePartyIssues({
    landlord: P("Ana Ruiz", "111"),
    tenant: P("Juan Pérez", "222"),
    solidaryCoDebtor: P("Juan Pérez", "2.2.2"),
  });
  assert.ok(out.some((i) => i.message.includes(SAME_PERSON)));
});

test("inquilino y codeudor DISTINTOS → sin error", () => {
  const out = duplicatePartyIssues({
    landlord: P("Ana Ruiz", "111"),
    tenant: P("Juan Pérez", "222"),
    solidaryCoDebtor: P("Pedro Gómez", "333"),
  });
  assert.equal(out.length, 0);
});

test("dos codeudores con el mismo documento → error", () => {
  const out = duplicatePartyIssues({
    landlord: P("Ana Ruiz", "111"),
    tenant: P("Juan Pérez", "222"),
    solidaryCoDebtors: [P("Pedro Gómez", "333"), P("Pedro G.", "333")],
  });
  assert.ok(out.some((i) => i.message.includes(SAME_PERSON)));
});

test("documento vacío en ambos → no marca (evita falsos positivos)", () => {
  const out = duplicatePartyIssues({
    landlord: P("Ana Ruiz", ""),
    tenant: P("Juan Pérez", ""),
    solidaryCoDebtor: P("Pedro Gómez", ""),
  });
  assert.equal(out.length, 0);
});
