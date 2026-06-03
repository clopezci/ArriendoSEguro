import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, clientIpFromRequest, tooManyRequestsJson } from "./rate-limit";

// Sin variables de Upstash, checkRateLimit usa el limitador en memoria (determinista).
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

test("clientIpFromRequest toma la primera IP de x-forwarded-for", () => {
  const req = new Request("https://x", {
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
  });
  assert.equal(clientIpFromRequest(req), "1.2.3.4");
});

test("clientIpFromRequest cae a x-real-ip y luego a 'anon'", () => {
  const conReal = new Request("https://x", { headers: { "x-real-ip": "9.9.9.9" } });
  assert.equal(clientIpFromRequest(conReal), "9.9.9.9");
  assert.equal(clientIpFromRequest(new Request("https://x")), "anon");
});

test("checkRateLimit (memoria) permite hasta el límite y luego bloquea", async () => {
  const rule = { limit: 3, windowSeconds: 60, prefix: "test-block" };
  const id = "ip-bloqueo";
  for (let i = 0; i < 3; i++) {
    const r = await checkRateLimit(id, rule);
    assert.equal(r.ok, true, `intento ${i + 1} debería permitirse`);
  }
  const blocked = await checkRateLimit(id, rule);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds >= 1, "debe sugerir un retry-after");
});

test("checkRateLimit separa contadores por identificador", async () => {
  const rule = { limit: 1, windowSeconds: 60, prefix: "test-sep" };
  assert.equal((await checkRateLimit("a", rule)).ok, true);
  assert.equal((await checkRateLimit("a", rule)).ok, false);
  // Otro identificador no se ve afectado por el bloqueo del primero.
  assert.equal((await checkRateLimit("b", rule)).ok, true);
});

test("tooManyRequestsJson incluye Retry-After y cuerpo de error", () => {
  const { body, headers } = tooManyRequestsJson(42);
  assert.equal(headers["Retry-After"], "42");
  assert.equal(body.ok, false);
  assert.equal(body.success, false);
  assert.ok(body.errors[0]?.message.includes("42"));
});
