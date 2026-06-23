import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeSavedProfile,
  sanitizeSavedPropertyData,
  sanitizePropertyLabel,
} from "./savedEntities";

test("perfil: null si falta nombre o documento", () => {
  assert.equal(sanitizeSavedProfile({}), null);
  assert.equal(sanitizeSavedProfile({ fullName: "Ana" }), null);
  assert.equal(sanitizeSavedProfile({ documentNumber: "123" }), null);
});

test("perfil: copia campos y nunca deja undefined", () => {
  const p = sanitizeSavedProfile({
    fullName: "  Ana Gómez ",
    documentNumber: " 123 ",
    documentType: "CC",
    city: "Bogotá",
    email: "a@b.co",
    phone: "3001234567",
    notificationAddress: "Calle 1",
    notificationAddressParts: { viaTipo: "CALLE" },
    truthfulnessOath: true, // se ignora
  });
  assert.ok(p);
  assert.equal(p!.fullName, "Ana Gómez");
  assert.equal(p!.documentNumber, "123");
  assert.equal((p as Record<string, unknown>).truthfulnessOath, undefined);
  assert.notEqual(p!.notificationAddressParts, undefined);
});

test("inmueble: numéricos saneados a número o null, sin undefined", () => {
  const d = sanitizeSavedPropertyData({
    address: "Carrera 7 # 1-2",
    city: "Bogotá",
    commercialValue: "120000000",
    monthlyRentProposed: 1200000,
    type: "apartamento",
  });
  assert.equal(d.commercialValue, 120000000);
  assert.equal(d.monthlyRentProposed, 1200000);
  assert.equal(d.department, "");
  assert.equal(d.addressParts, null);
  // Sin valores undefined (Firestore los rechaza).
  for (const v of Object.values(d)) assert.notEqual(v, undefined);
});

test("etiqueta: usa la dirección si no hay nombre", () => {
  const d = sanitizeSavedPropertyData({ address: "Calle 10 # 5-5" });
  assert.equal(sanitizePropertyLabel("", d), "Calle 10 # 5-5");
  assert.equal(sanitizePropertyLabel("Apto Centro", d), "Apto Centro");
});
