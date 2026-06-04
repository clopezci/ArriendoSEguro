# Checklist: Lighthouse, Accesibilidad (AA) y PWA

> El puntaje real de Lighthouse solo se confirma corriéndolo en tu navegador.
> Esta lista resume lo ya implementado y cómo verificarlo tú.

## Cómo correr Lighthouse (gratis, en tu Chrome)

1. Abre el sitio en **Chrome** (modo incógnito para no contaminar con extensiones).
2. `F12` → pestaña **Lighthouse**.
3. Marca **Performance, Accessibility, Best Practices, SEO, PWA**.
4. Elige **Mobile** y **Analyze page load**. Repite en **Desktop**.
5. Corre en varias páginas clave: `/`, `/calculadoras`, `/dashboard/plans`, una del wizard.

## Ya implementado (código)

- [x] **PWA instalable:** `manifest.webmanifest` con `id`, `scope`, `start_url`, `lang`, `categories`, `orientation`, `theme_color` (#6d28d9) y `background_color` claro.
- [x] **Íconos escalables:** `/icons/icon.svg` (any) y `/icons/maskable.svg` (con zona segura) + PNG 512 de respaldo.
- [x] **Service worker** network-first en navegación (sin contenido viejo tras deploy) con **fallback offline** (`/offline.html`) cuando no hay conexión.
- [x] **theme-color / colorScheme / viewport** vía `export const viewport` en el layout.
- [x] **iOS:** `appleWebApp` (capable, título, status bar) y `apple-touch-icon`.
- [x] **Accesibilidad base:** foco visible global, "saltar al contenido", `prefers-reduced-motion`, contraste corregido en header y páginas legales.
- [x] **Diálogos:** `role="dialog"`, `aria-modal`, `aria-labelledby`, cierre con **Escape** y foco al abrir (diálogo de instalación PWA).
- [x] **Formularios:** inputs dentro de `<label>` o con `aria-label` (calculadoras, referidos, consulta de reputación).
- [x] **Navegación:** `nav` con `aria-label`; enlaces con texto descriptivo.
- [x] **SEO:** `metadata` por página, `metadataBase`, sitemap y robots; JSON-LD en calculadoras.

## Verifica tú (manual)

- [ ] Lighthouse **Accessibility ≥ 95** en las páginas clave (idealmente 100).
- [ ] Lighthouse **PWA**: "Installable" en verde y sin advertencias del manifest.
- [ ] Navega **solo con teclado** (Tab/Shift+Tab/Enter/Esc) por el wizard y el dashboard: el foco se ve y el orden es lógico.
- [ ] Prueba **offline** (DevTools → Network → Offline) y recarga: debe aparecer la página "Estás sin conexión".
- [ ] Instala la PWA en tu teléfono y verifica el ícono y el color de la barra.
- [ ] Revisa contraste de texto sobre fondos de color (Lighthouse lo reporta).

## Si Lighthouse marca algo

Anota la página y el ítem (p. ej. "contraste insuficiente en botón X" o "imagen sin alt") y pásamelo: son arreglos puntuales y rápidos.
