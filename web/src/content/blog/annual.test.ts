import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOG_ARTICLES, getArticleBySlug } from "./articles";
import { annualKeysUsed, resolveArticleAnnual } from "./annual";
import type { AnnualValues } from "@/domain/annual/annualValues";

const values: AnnualValues = {
  ipc: { percent: 6.02, year: 2026, appliesTo: 2027, source: "DANE", sourceUrl: "https://www.dane.gov.co/ipc", updatedAt: "2027-01-10T14:00:00.000Z", updatedBy: "auto (DANE)" },
  uvt: { value: 55000, year: 2027, source: "DIAN", sourceUrl: "https://www.dian.gov.co/", updatedAt: null, updatedBy: null },
};

test("el artículo del IPC tiene slug permanente (sin año) y usa variables", () => {
  const a = getArticleBySlug("reajuste-canon-arrendamiento-ipc");
  assert.ok(a);
  assert.deepEqual(annualKeysUsed(a), ["ipc"]);
  assert.equal(getArticleBySlug("reajuste-canon-arrendamiento-ipc-2026"), undefined);
});

test("al resolver no queda ninguna variable sin reemplazar y las cifras son las vigentes", () => {
  const a = resolveArticleAnnual(getArticleBySlug("reajuste-canon-arrendamiento-ipc")!, values);
  const raw = JSON.stringify(a);
  assert.doesNotMatch(raw, /\{(ipc|uvt)\./);
  assert.match(raw, /IPC de 2026 fue de 6,02 %/);
  assert.match(raw, /\$1\.060\.200/); // 1.000.000 × 1,0602
  assert.equal(a.metaTitle, "Reajuste del canon con el IPC: cuánto puede subir el arriendo en 2027");
  assert.equal(a.dateModified, "2027-01-10"); // toma la fecha del dato si es más reciente
});

test("títulos y descripciones visibles en listados no llevan variables", () => {
  for (const a of BLOG_ARTICLES) {
    assert.doesNotMatch(`${a.title} ${a.description}`, /\{(ipc|uvt)\./, a.slug);
  }
});
