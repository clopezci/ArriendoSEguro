import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffSupportFileKind, isAllowedSupportMagic } from "./supportValidation";

function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

test("reconoce PDF por %PDF", () => {
  assert.equal(sniffSupportFileKind(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31)), "pdf");
});

test("reconoce JPG por FF D8 FF", () => {
  assert.equal(sniffSupportFileKind(bytes(0xff, 0xd8, 0xff, 0xe0)), "jpg");
});

test("reconoce PNG por su firma de 8 bytes", () => {
  assert.equal(sniffSupportFileKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "png");
});

test("reconoce WEBP por RIFF....WEBP", () => {
  // "RIFF" + 4 bytes de tamaño + "WEBP"
  assert.equal(
    sniffSupportFileKind(bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50)),
    "webp",
  );
});

test("rechaza un ejecutable disfrazado (MZ)", () => {
  assert.equal(sniffSupportFileKind(bytes(0x4d, 0x5a, 0x90, 0x00)), null);
  assert.equal(isAllowedSupportMagic(bytes(0x4d, 0x5a, 0x90, 0x00)), false);
});

test("rechaza ZIP/Office (PK) que no es soporte permitido", () => {
  assert.equal(sniffSupportFileKind(bytes(0x50, 0x4b, 0x03, 0x04)), null);
});

test("rechaza buffer vacío o muy corto", () => {
  assert.equal(sniffSupportFileKind(bytes()), null);
  assert.equal(sniffSupportFileKind(bytes(0x25)), null);
});

test("isAllowedSupportMagic acepta formatos válidos", () => {
  assert.equal(isAllowedSupportMagic(bytes(0x25, 0x50, 0x44, 0x46)), true);
  assert.equal(isAllowedSupportMagic(bytes(0xff, 0xd8, 0xff)), true);
});
