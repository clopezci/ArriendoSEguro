import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isInviteUsable,
  savedPartyProfileKey,
  normalizeEmail,
  isPartyRole,
  partyRoleLabel,
  type PartyInviteDoc,
} from "./partyInvite";

const base: PartyInviteDoc = {
  token: "t",
  contractDraftId: "c1",
  role: "tenant",
  inviteeEmail: "a@b.co",
  inviteeName: "Ana",
  inviterUid: "u1",
  inviterEmail: "owner@x.co",
  inviterName: "Dueño",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-01-15T00:00:00.000Z",
};

test("isInviteUsable: activo y no expirado", () => {
  const now = Date.parse("2026-01-05T00:00:00.000Z");
  assert.equal(isInviteUsable(base, now), true);
});

test("isInviteUsable: expirado -> false", () => {
  const now = Date.parse("2026-02-01T00:00:00.000Z");
  assert.equal(isInviteUsable(base, now), false);
});

test("isInviteUsable: completado -> false", () => {
  const now = Date.parse("2026-01-05T00:00:00.000Z");
  assert.equal(isInviteUsable({ ...base, status: "completed" }, now), false);
});

test("isInviteUsable: null -> false", () => {
  assert.equal(isInviteUsable(null, Date.now()), false);
});

test("normalizeEmail recorta y minúsculas", () => {
  assert.equal(normalizeEmail("  ANA@B.CO "), "ana@b.co");
});

test("savedPartyProfileKey combina rol + email normalizado", () => {
  assert.equal(savedPartyProfileKey("tenant", " Ana@B.co"), "tenant__ana@b.co");
  assert.equal(savedPartyProfileKey("solidaryCoDebtor", "x@y.z"), "solidaryCoDebtor__x@y.z");
});

test("isPartyRole valida el rol", () => {
  assert.equal(isPartyRole("tenant"), true);
  assert.equal(isPartyRole("solidaryCoDebtor"), true);
  assert.equal(isPartyRole("landlord"), false);
});

test("partyRoleLabel devuelve etiqueta", () => {
  assert.match(partyRoleLabel("tenant"), /inquilino/i);
  assert.match(partyRoleLabel("solidaryCoDebtor"), /codeudor/i);
});
