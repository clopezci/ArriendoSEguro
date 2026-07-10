import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStep, type Answers } from "./validation";

const base: Answers = {
  contractType: "VIVIENDA_URBANA",
  name: "", docType: "CC", docNumber: "", phone: "", email: "",
  acting: "", proxyOath: false, address: "", city: "",
  registry: "", propertyType: "", registrySkip: false, canon: "",
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

test("dirección: emoji/símbolos o sin letras → error; válida → ok", () => {
  assert.ok(validateStep("addr", a({ address: "Calle 32 😀", city: "Medellin" })));   // emoji
  assert.ok(validateStep("addr", a({ address: "1234", city: "Medellin" })));           // sin letras
  assert.ok(validateStep("addr", a({ address: "cr", city: "Medellin" })));             // muy corta
  assert.equal(validateStep("addr", a({ address: "Carrera 32 # 25-48", city: "Medellin" })), null);
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

test("tipo de contrato: con valor → ok", () => {
  assert.ok(validateStep("ctype", a({ contractType: "" })));
  assert.equal(validateStep("ctype", a({ contractType: "VIVIENDA_URBANA" })), null);
});

test("calidad: sin elegir → error; apoderado sin juramento → error; dueño → ok", () => {
  assert.ok(validateStep("acting", a({ acting: "" })));
  assert.ok(validateStep("acting", a({ acting: "proxy", proxyOath: false })));
  assert.equal(validateStep("acting", a({ acting: "proxy", proxyOath: true })), null);
  assert.equal(validateStep("acting", a({ acting: "owner" })), null);
});

test("matrícula/tipo: sin tipo → error; sin matrícula y sin saltar → error; saltar → ok", () => {
  assert.ok(validateStep("registry", a({ propertyType: "", registry: "050-1" })));
  assert.ok(validateStep("registry", a({ propertyType: "Casa", registry: "", registrySkip: false })));
  assert.equal(validateStep("registry", a({ propertyType: "Casa", registry: "", registrySkip: true })), null);
  assert.equal(validateStep("registry", a({ propertyType: "Casa", registry: "050-123456" })), null);
});
