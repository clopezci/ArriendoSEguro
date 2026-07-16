import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Humo de páginas PÚBLICAS (sin login): cargan bien y no tienen violaciones de
 * accesibilidad CRÍTICAS. Se ejecuta en Chromium/WebKit/Firefox + móvil.
 * El umbral está en "critical" para arrancar en verde; se puede endurecer a
 * incluir "serious" cuando se limpien esas.
 */
const PUBLIC_PAGES = [
  { path: "/", name: "Inicio" },
  { path: "/entiendelo-facil", name: "Cómo funciona" },
  { path: "/calculadoras", name: "Calculadoras" },
];

for (const p of PUBLIC_PAGES) {
  test(`${p.name} carga y no tiene errores de accesibilidad críticos`, async ({ page }) => {
    const resp = await page.goto(p.path, { waitUntil: "domcontentloaded" });
    expect(resp?.status(), `HTTP de ${p.path}`).toBeLessThan(400);

    // Hay contenido visible.
    await expect(page.locator("h1, main").first()).toBeVisible();

    // Accesibilidad automática (axe): sin violaciones críticas.
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `Violaciones críticas en ${p.path}: ${JSON.stringify(critical.map((v) => v.id))}`,
    ).toEqual([]);
  });
}
