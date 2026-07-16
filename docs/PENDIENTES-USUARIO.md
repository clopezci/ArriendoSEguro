# Pendientes que dependen de ti (paso a paso)

Este documento lista lo que **tú** debes hacer para cerrar los puntos de calidad
(ISO/IEC 25000) que **no** puedo hacer yo porque requieren tus cuentas, trámites
o decisiones. Todo lo demás (error boundaries, CI, Dependabot, Speed Insights,
Playwright + axe, validación, seguridad) ya quedó hecho en el código.

Retómalo **después de terminar tus pruebas**. Orden sugerido: 1 → 2 → 3 → 4 → 5.

---

## 1. Activar 2FA (verificación en dos pasos) en tu cuenta de dueño
**Por qué:** protege tu cuenta de administrador aunque te roben la contraseña.
**Costo:** gratis (incluido en Firebase).
**Pasos:**
1. Entra a la **consola de Firebase**: https://console.firebase.google.com
2. Elige tu proyecto de ArriendoSeguro.
3. Menú izquierdo → **Authentication** → pestaña **Sign-in method**.
4. Busca **Multi-factor authentication** (Autenticación multifactor) → **Enable**.
5. Guarda. Luego, al iniciar sesión, podrás registrar tu número para el código SMS/app.

---

## 2. Registro de Bases de Datos ante la SIC (RNBD) — Ley 1581 de 2012
**Por qué:** en Colombia, tratar datos personales obliga a registrar tus bases de
datos ante la Superintendencia de Industria y Comercio (SIC). Es requisito legal.
**Costo:** gratis (trámite en línea).
**Pasos:**
1. Entra al portal de la SIC → **RNBD** (Registro Nacional de Bases de Datos):
   busca "SIC RNBD" o entra a https://www.sic.gov.co (sección Protección de Datos).
2. Crea/usa tu usuario y registra tu empresa (LOTIC Soluciones).
3. Declara tus bases de datos (ej.: "usuarios", "contratos/expedientes",
   "consultas de reputación"). Indica finalidad, política de tratamiento y contacto.
4. Guarda el certificado de registro.
> Nota: revisa los plazos y umbrales vigentes con la SIC; algunas empresas peque-
> ñas tienen condiciones especiales. Ante la duda, confírmalo con tu abogado.

---

## 3. Visto bueno legal de privacidad y consentimientos
**Por qué:** que un abogado valide los textos legales antes de publicitarlos.
**Pasos:**
1. Pídele a un abogado que revise: **aviso de privacidad** (`/legal/aviso-privacidad`),
   **términos** (`/legal/terminos`), los textos de **consentimiento Habeas Data** y
   la **consulta de reputación** (esta última especialmente).
2. Ajusta lo que indique. Si hay cambios de texto, me los pasas y los aplico.

---

## 4. Monitoreo de disponibilidad (¿está caída la web?)
**Por qué:** enterarte tú antes que tus usuarios si el sitio se cae.
**Costo:** gratis.
**Pasos:**
1. Crea cuenta en **UptimeRobot** (https://uptimerobot.com) o **Better Stack**.
2. Agrega un monitor tipo HTTP(s) a: `https://arriendoseguro.app`
3. Intervalo 5 min; alerta a tu correo/WhatsApp.
4. (Opcional) agrega un segundo monitor a `https://arriendoseguro.app/api/status`.

---

## 5. Reportes de errores en producción (opcional — Sentry)
**Ya tienes** una captura de errores propia (se guardan en la colección
`error_events` de Firebase, con datos personales enmascarados) y **error boundaries**
que evitan la pantalla en blanco. Sentry es **opcional**, solo si quieres un panel
más cómodo con alertas.
**Si lo quieres:**
1. Crea cuenta gratis en **Sentry** (https://sentry.io) y un proyecto "Next.js".
2. Copia el **DSN** (una URL que te da Sentry) y pásamelo.
3. Yo lo integro (queda inactivo hasta que exista el DSN, así que no molesta).

---

## Cosas que YA quedaron listas (solo para tu información)
- **CI (GitHub Actions):** en cada cambio corre lint + pruebas + build. Míralo en
  la pestaña **Actions** de tu repositorio en GitHub. Si algo sale en rojo, avísame.
- **E2E (Playwright + axe):** workflow aparte que prueba páginas públicas en
  Chrome/Safari/Firefox + accesibilidad. Para correrlo en tu PC:
  `cd web && npm run build && npx playwright install && npm run e2e`
  (contra producción: `E2E_BASE_URL=https://arriendoseguro.app npm run e2e`).
- **Dependabot:** te abrirá **Pull Requests** semanales cuando haya dependencias
  con vulnerabilidades. Tu tarea: revisarlos y, si el CI queda verde, aceptarlos
  (botón **Merge**). Ante la duda, me consultas.
- **Rendimiento (Speed Insights):** si estás en Vercel, ya se recogen métricas
  reales; míralas en el panel de Vercel → tu proyecto → pestaña **Speed Insights**.
  Medición puntual gratis: https://pagespeed.web.dev (pega tu URL).
- **Accesibilidad:** el e2e ya revisa violaciones críticas con axe. Para una
  revisión manual: instala la extensión **axe DevTools** o usa Lighthouse (F12 →
  Lighthouse) en tu navegador.
