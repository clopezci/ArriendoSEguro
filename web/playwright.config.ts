import { defineConfig, devices } from "@playwright/test";

/**
 * E2E (Playwright) — humo multi-navegador + accesibilidad (axe) de páginas
 * públicas. Cubre "compatibilidad/portabilidad" (Chromium/WebKit/Firefox +
 * móvil) y "usabilidad/accesibilidad" sin depender de credenciales.
 *
 * Local:  npm run build && npm run e2e
 * Contra un despliegue:  E2E_BASE_URL=https://arriendoseguro.app npm run e2e
 */
const PORT = 3000;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  // Si se apunta a un despliegue (E2E_BASE_URL), no levantamos servidor local.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
