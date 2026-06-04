import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseIncomingDraft,
  buildDraftDocument,
  mergeDraftsByRecency,
  MAX_DRAFT_PAYLOAD_CHARS,
} from "./contractDraftSync";

test("parseIncomingDraft acepta un borrador con los campos mínimos y conserva extras", () => {
  const r = parseIncomingDraft({ id: "ct_1", userId: "u1", lastUpdatedAt: "2026-06-04T00:00:00.000Z", foo: "bar" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.draft.id, "ct_1");
    assert.equal((r.draft as Record<string, unknown>).foo, "bar");
  }
});

test("parseIncomingDraft rechaza si faltan campos del envoltorio", () => {
  assert.equal(parseIncomingDraft({ id: "ct_1" }).ok, false);
  assert.equal(parseIncomingDraft(null).ok, false);
  assert.equal(parseIncomingDraft({ id: "", userId: "u", lastUpdatedAt: "x" }).ok, false);
});

test("parseIncomingDraft rechaza borradores demasiado grandes", () => {
  const big = "x".repeat(MAX_DRAFT_PAYLOAD_CHARS + 10);
  const r = parseIncomingDraft({ id: "ct_1", userId: "u1", lastUpdatedAt: "2026-06-04T00:00:00.000Z", blob: big });
  assert.equal(r.ok, false);
});

test("buildDraftDocument fija el dueño con el uid del servidor (no el del cuerpo)", () => {
  const r = parseIncomingDraft({ id: "ct_1", userId: "atacante", lastUpdatedAt: "2026-06-04T00:00:00.000Z" });
  assert.equal(r.ok, true);
  if (r.ok) {
    const doc = buildDraftDocument("uid-real", r.draft);
    assert.equal(doc.ownerUid, "uid-real");
    assert.equal(doc.draftId, "ct_1");
    assert.equal(doc.payload.userId, "atacante"); // el payload se conserva, pero el dueño es el uid del token
  }
});

test("mergeDraftsByRecency conserva la versión más reciente por id", () => {
  const local = [
    { id: "a", lastUpdatedAt: "2026-06-01T00:00:00.000Z", v: "local-a" },
    { id: "b", lastUpdatedAt: "2026-06-03T00:00:00.000Z", v: "local-b" },
  ];
  const remote = [
    { id: "a", lastUpdatedAt: "2026-06-02T00:00:00.000Z", v: "remote-a" }, // más nuevo que local-a
    { id: "c", lastUpdatedAt: "2026-06-04T00:00:00.000Z", v: "remote-c" }, // solo en servidor
  ];
  const merged = mergeDraftsByRecency(local, remote);
  const byId = Object.fromEntries(merged.map((d) => [d.id, d.v]));
  assert.equal(byId.a, "remote-a");
  assert.equal(byId.b, "local-b");
  assert.equal(byId.c, "remote-c");
  // Orden: más reciente primero (c, b, a).
  assert.deepEqual(merged.map((d) => d.id), ["c", "b", "a"]);
});

test("mergeDraftsByRecency trata fechas inválidas como las más antiguas", () => {
  const local = [{ id: "a", lastUpdatedAt: "no-es-fecha", v: "local" }];
  const remote = [{ id: "a", lastUpdatedAt: "2026-06-04T00:00:00.000Z", v: "remote" }];
  const merged = mergeDraftsByRecency(local, remote);
  assert.equal(merged[0].v, "remote");
});
