import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPropertyDocType,
  safePropertyDocFilename,
  propertyDocObjectPath,
  assertValidPropertyDocGsPath,
} from "./property-documents";

test("isPropertyDocType valida el enum", () => {
  assert.equal(isPropertyDocType("poder"), true);
  assert.equal(isPropertyDocType("escritura"), true);
  assert.equal(isPropertyDocType("nope"), false);
});

test("safePropertyDocFilename limpia y evita rutas", () => {
  assert.equal(safePropertyDocFilename("../../etc/passwd"), "passwd");
  assert.equal(safePropertyDocFilename("Poder Notaría #3.pdf"), "Poder_Notar_a__3.pdf");
});

test("propertyDocObjectPath arma la ruta esperada", () => {
  const p = propertyDocObjectPath("ct_1", "poder", 123, "poder.pdf");
  assert.equal(p, "contracts/ct_1/property-documents/poder/123-poder.pdf");
});

test("assertValidPropertyDocGsPath acepta ruta correcta y rechaza la ajena", () => {
  const ok = assertValidPropertyDocGsPath("gs://bucket/contracts/ct_1/property-documents/poder/9-x.pdf", {
    expectedBucket: "bucket",
    contractId: "ct_1",
    docType: "poder",
  });
  assert.deepEqual(ok, { objectPath: "contracts/ct_1/property-documents/poder/9-x.pdf" });

  // Bucket equivocado.
  assert.equal(
    assertValidPropertyDocGsPath("gs://otro/contracts/ct_1/property-documents/poder/9-x.pdf", {
      expectedBucket: "bucket",
      contractId: "ct_1",
      docType: "poder",
    }),
    null,
  );
  // Otro contrato.
  assert.equal(
    assertValidPropertyDocGsPath("gs://bucket/contracts/ct_2/property-documents/poder/9-x.pdf", {
      expectedBucket: "bucket",
      contractId: "ct_1",
      docType: "poder",
    }),
    null,
  );
  // Traversal.
  assert.equal(
    assertValidPropertyDocGsPath("gs://bucket/contracts/ct_1/property-documents/poder/../../x", {
      expectedBucket: "bucket",
      contractId: "ct_1",
      docType: "poder",
    }),
    null,
  );
});
