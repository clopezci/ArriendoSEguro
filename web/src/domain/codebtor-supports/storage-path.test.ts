import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGsUri, assertValidCodebtorSupportGsPath } from "./storage-path";

test("parseGsUri interpreta gs://bucket/objeto", () => {
  assert.deepEqual(parseGsUri("gs://mi-bucket/contracts/c1/x.pdf"), {
    bucket: "mi-bucket",
    objectPath: "contracts/c1/x.pdf",
  });
});

test("parseGsUri rechaza esquemas no gs:// o sin objeto", () => {
  assert.equal(parseGsUri("https://mi-bucket/x.pdf"), null);
  assert.equal(parseGsUri("gs://solo-bucket"), null);
  assert.equal(parseGsUri("gs:///objeto-sin-bucket"), null);
  assert.equal(parseGsUri("  "), null);
});

const baseOpts = {
  expectedBucket: "mi-bucket",
  contractId: "c1",
  supportType: "carta_laboral" as const,
};

test("assertValidCodebtorSupportGsPath acepta la ruta esperada", () => {
  const ok = assertValidCodebtorSupportGsPath(
    "gs://mi-bucket/contracts/c1/codebtor-supports/carta_laboral/123-archivo.pdf",
    baseOpts,
  );
  assert.deepEqual(ok, { objectPath: "contracts/c1/codebtor-supports/carta_laboral/123-archivo.pdf" });
});

test("assertValidCodebtorSupportGsPath rechaza bucket ajeno", () => {
  const r = assertValidCodebtorSupportGsPath(
    "gs://otro-bucket/contracts/c1/codebtor-supports/carta_laboral/x.pdf",
    baseOpts,
  );
  assert.equal(r, null);
});

test("assertValidCodebtorSupportGsPath rechaza contrato o tipo que no coinciden", () => {
  assert.equal(
    assertValidCodebtorSupportGsPath(
      "gs://mi-bucket/contracts/OTRO/codebtor-supports/carta_laboral/x.pdf",
      baseOpts,
    ),
    null,
  );
  assert.equal(
    assertValidCodebtorSupportGsPath(
      "gs://mi-bucket/contracts/c1/codebtor-supports/colilla/x.pdf",
      baseOpts,
    ),
    null,
  );
});

test("assertValidCodebtorSupportGsPath rechaza prefijo sin archivo y rutas fuera del prefijo", () => {
  // Prefijo correcto pero sin nombre de archivo después.
  assert.equal(
    assertValidCodebtorSupportGsPath(
      "gs://mi-bucket/contracts/c1/codebtor-supports/carta_laboral/",
      baseOpts,
    ),
    null,
  );
  // Intento de salir del directorio esperado.
  assert.equal(
    assertValidCodebtorSupportGsPath("gs://mi-bucket/otra-cosa/x.pdf", baseOpts),
    null,
  );
});
