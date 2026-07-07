import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStep, type Answers } from "./validation";

const base: Answers = {
  name: "", docType: "CC", docNumber: "", phone: "", email: "", address: "", city: "", canon: "",
  tenantMode: "self", tenantName: "", hasCodebtor: "", codebtorName: "", docMethod: "", docPhone: "", docEmail: "",
};
const a = (o: Partial<Answers>): Answers => ({ ...base, ...o });

test("nombre: vacío, corto o con números → error; válido → ok", () => {
  assert.ok(validateStep("text", a({ name: "" })));
  assert.ok(validateStep("text", a({ name: "Ana" })));       // muy corto
  assert.ok(validateStep("text", a({ name: "Juan123" })));   // números
  assert.equal(validateStep("text", a({ name: "Juan Pérez" })), null);
});

test("documento CC: vacío, con letras o corto → error; válido → ok", () => {
  assert.ok(validateStep("doc", a({ docType: "CC", docNumber: "" })));
  assert.ok(validateStep("doc", a({ docType: "CC", docNumber: "12ab34" })));
  assert.equal(validateStep("doc", a({ docType: "CC", docNumber: "79000000" })), null);
});

test("contacto: teléfono con menos de 10 dígitos → error; correo inválido → error", () => {
  assert.ok(validateStep("contact", a({ phone: "3001234", email: "a@b.com" })));       // teléfono corto
  assert.ok(validateStep("contact", a({ phone: "3001234567", email: "correo-malo" }))); // correo inválido
  assert.equal(validateStep("contact", a({ phone: "3001234567", email: "a@b.com" })), null);
});

test("canon: cero o texto → error; positivo → ok", () => {
  assert.ok(validateStep("canon", a({ canon: "0" })));
  assert.ok(validateStep("canon", a({ canon: "abc" })));
  assert.equal(validateStep("canon", a({ canon: "$ 1.500.000" })), null);
});

test("codeudor: sin elegir → error; sí sin nombre → error; no → ok", () => {
  assert.ok(validateStep("codebtor", a({ hasCodebtor: "" })));
  assert.ok(validateStep("codebtor", a({ hasCodebtor: "yes", codebtorName: "" })));
  assert.equal(validateStep("codebtor", a({ hasCodebtor: "no" })), null);
  assert.equal(validateStep("codebtor", a({ hasCodebtor: "yes", codebtorName: "María López" })), null);
});

test("documentos: sin método → error; WhatsApp con teléfono corto → error; self → ok", () => {
  assert.ok(validateStep("docs", a({ docMethod: "" })));
  assert.ok(validateStep("docs", a({ docMethod: "whatsapp", docPhone: "300" })));
  assert.equal(validateStep("docs", a({ docMethod: "self" })), null);
  assert.equal(validateStep("docs", a({ docMethod: "whatsapp", docPhone: "3001234567" })), null);
});
