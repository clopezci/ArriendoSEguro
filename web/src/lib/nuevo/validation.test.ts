import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStep, type Answers } from "./validation";

const base: Answers = {
  contractType: "VIVIENDA_URBANA",
  name: "", docType: "CC", docNumber: "", phone: "", email: "", ownerCity: "",
  acting: "", proxyOath: false, poderdanteName: "",
  propertyAlias: "",
  address: "", city: "", department: "",
  registry: "", propertyType: "", registrySkip: false, propertyDocType: "", propertyOath: false,
  canon: "", commercialValue: "", noCommercialValue: false,
  reqDocsTenant: [], reqDocsCodebtor: [],
  startDate: "", termMonths: "12", paymentDay: "5",
  tenantMode: "self", tenantName: "",
  tenantDocType: "CC", tenantDocNumber: "", tenantCity: "", tenantEmail: "", tenantPhone: "", tenantAuth: false, tenantIncome: "",
  hasCodebtor: "", codebtorName: "", codebtorMode: "self",
  codebtorDocType: "CC", codebtorDocNumber: "", codebtorCity: "", codebtorEmail: "", codebtorPhone: "", codebtorAuth: false, codebtorIncome: "",
  utilitiesParty: "", adminParty: "", paymentSupportPolicy: "notifications", clauses: [], clauseOther: "", clauseCount: 1,
  docMethod: "", docPhone: "", docEmail: "",
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
  assert.ok(validateStep("contact", a({ phone: "3001234", email: "a@b.com", ownerCity: "Cali" })));       // teléfono corto
  assert.ok(validateStep("contact", a({ phone: "3001234567", email: "correo-malo", ownerCity: "Cali" }))); // correo inválido
  assert.equal(validateStep("contact", a({ phone: "3001234567", email: "a@b.com", ownerCity: "Cali" })), null);
});

test("dirección: emoji/símbolos o sin letras → error; válida → ok", () => {
  assert.ok(validateStep("addr", a({ address: "Calle 32 😀", city: "Medellin", department: "Antioquia" })));   // emoji
  assert.ok(validateStep("addr", a({ address: "1234", city: "Medellin", department: "Antioquia" })));           // sin letras
  assert.ok(validateStep("addr", a({ address: "cr", city: "Medellin", department: "Antioquia" })));             // muy corta
  assert.equal(validateStep("addr", a({ address: "Carrera 32 # 25-48", city: "Medellin", department: "Antioquia" })), null);
});

test("canon: cero/texto → error; sin valor comercial → pide valor o acuse; tope Ley 820", () => {
  assert.ok(validateStep("canon", a({ canon: "0" })));
  assert.ok(validateStep("canon", a({ canon: "abc" })));
  // canon válido pero sin valor comercial ni acuse → pide uno u otro
  assert.ok(validateStep("canon", a({ canon: "1500000" })));
  // acepta seguir sin validar el tope
  assert.equal(validateStep("canon", a({ canon: "1500000", noCommercialValue: true })), null);
  // canon supera el 1% del valor comercial → error
  assert.ok(validateStep("canon", a({ canon: "3000000", commercialValue: "200000000" }))); // tope 2.000.000
  // canon dentro del tope → ok
  assert.equal(validateStep("canon", a({ canon: "1500000", commercialValue: "200000000" })), null);
});

test("codeudor: sin elegir → error; elegido (sí/no) → ok (el nombre se pide en el paso siguiente)", () => {
  assert.ok(validateStep("codebtor", a({ hasCodebtor: "" })));
  assert.equal(validateStep("codebtor", a({ hasCodebtor: "no" })), null);
  assert.equal(validateStep("codebtor", a({ hasCodebtor: "yes" })), null);
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

test("calidad: sin elegir → error; apoderado sin poderdante/juramento → error; dueño → ok", () => {
  assert.ok(validateStep("acting", a({ acting: "" })));
  assert.ok(validateStep("acting", a({ acting: "proxy", poderdanteName: "", proxyOath: true }))); // falta nombre del poderdante
  assert.ok(validateStep("acting", a({ acting: "proxy", poderdanteName: "Ana Ruiz", proxyOath: false }))); // falta juramento
  assert.equal(validateStep("acting", a({ acting: "proxy", poderdanteName: "Ana Ruiz", proxyOath: true })), null);
  assert.equal(validateStep("acting", a({ acting: "owner" })), null);
});

test("inmueble: sin tipo → error; sin juramento → error; el documento es saltable (pendiente al generar)", () => {
  assert.ok(validateStep("registry", a({ propertyType: "", propertyDocType: "tradicion", propertyOath: true })));   // sin tipo → error
  assert.ok(validateStep("registry", a({ propertyType: "Casa", propertyDocType: "tradicion", propertyOath: false }))); // sin juramento → error
  // El tipo de documento es opcional en este paso (se puede subir más tarde):
  assert.equal(validateStep("registry", a({ propertyType: "Casa", propertyDocType: "", propertyOath: true })), null);
  assert.equal(validateStep("registry", a({ propertyType: "Casa", propertyDocType: "tradicion", propertyOath: true })), null);
});

test("contacto del dueño exige ciudad además de teléfono y correo", () => {
  assert.ok(validateStep("contact", a({ phone: "3001234567", email: "a@b.com", ownerCity: "" })));
  assert.equal(validateStep("contact", a({ phone: "3001234567", email: "a@b.com", ownerCity: "Medellín" })), null);
});

test("inmueble exige departamento además de dirección y ciudad", () => {
  assert.ok(validateStep("addr", a({ address: "Calle 32 # 25-48", city: "Medellín", department: "" })));
  assert.equal(validateStep("addr", a({ address: "Calle 32 # 25-48", city: "Medellín", department: "Antioquia" })), null);
});

test("términos: exige fecha, duración válida y día de pago 1-31", () => {
  assert.ok(validateStep("lease", a({ startDate: "", termMonths: "12", paymentDay: "5" })));
  assert.ok(validateStep("lease", a({ startDate: "2026-01-01", termMonths: "0", paymentDay: "5" })));
  assert.ok(validateStep("lease", a({ startDate: "2026-01-01", termMonths: "12", paymentDay: "40" })));
  assert.equal(validateStep("lease", a({ startDate: "2026-01-01", termMonths: "12", paymentDay: "5" })), null);
});

test("datos completos del inquilino: doc/ciudad/correo/tel + ingreso + autorización", () => {
  assert.ok(validateStep("tenantfull", a({ tenantDocNumber: "79000000", tenantCity: "Cali", tenantEmail: "t@b.com", tenantPhone: "3001234567", tenantIncome: "2000000", tenantAuth: false }))); // falta auth
  assert.ok(validateStep("tenantfull", a({ tenantDocNumber: "79000000", tenantCity: "Cali", tenantEmail: "t@b.com", tenantPhone: "3001234567", tenantIncome: "", tenantAuth: true }))); // falta ingreso
  assert.equal(validateStep("tenantfull", a({ tenantDocNumber: "79000000", tenantCity: "Cali", tenantEmail: "t@b.com", tenantPhone: "3001234567", tenantIncome: "2000000", tenantAuth: true })), null);
});

test("servicios: sin responsable → error; sin administración → error; ambos → ok", () => {
  assert.ok(validateStep("utils", a({ utilitiesParty: "", adminParty: "arrendatario" })));
  assert.ok(validateStep("utils", a({ utilitiesParty: "arrendatario", adminParty: "" })));
  assert.equal(validateStep("utils", a({ utilitiesParty: "arrendatario", adminParty: "no_aplica" })), null);
});

test("cláusulas: opcionales; 'Otra' sin texto → error; con texto → ok", () => {
  assert.equal(validateStep("clauses", a({ clauses: [] })), null);
  assert.equal(validateStep("clauses", a({ clauses: ["MASCOTAS"] })), null);
  assert.ok(validateStep("clauses", a({ clauses: ["OTRA"], clauseOther: "" })));
  assert.equal(validateStep("clauses", a({ clauses: ["OTRA"], clauseOther: "Prohibido subarrendar" })), null);
});
