# Pendientes que dependen de ti (paso a paso)

Este documento lista lo que **tú** debes hacer para cerrar los puntos de calidad
(ISO/IEC 25000) que **no** puedo hacer yo porque requieren tus cuentas, trámites
o decisiones. Todo lo demás (error boundaries, CI, Dependabot, Speed Insights,
Playwright + axe, validación, seguridad) ya quedó hecho en el código.

Retómalo **después de terminar tus pruebas**. Nota: el punto **2 (RNBD)** NO es para
ahora (ver por qué abajo). Prioridad práctica: **1 → 3 → 4 → 5**, y el 2 solo si
formalizas la empresa.

---

## 1. Activar 2FA en TU cuenta de dueño (la que administra el proyecto)
**Ojo — dos cosas distintas:**
- El **MFA de Firebase Authentication** (consola → Authentication) es 2FA para **los
  usuarios de la app** (arrendadores/inquilinos), NO para tu cuenta de administrador.
  Además, el MFA **por SMS cuesta** (cada mensaje). **Déjalo DESHABILITADO** por ahora;
  no lo necesitas para probar. Si algún día ofreces 2FA a tus usuarios, usa
  **app de autenticación (TOTP)**, que es gratis, no SMS.
- Para proteger **TU** acceso de dueño (la cuenta de Google que es dueña del proyecto),
  se hace en tu **Cuenta de Google**, no en Firebase.

**Por qué:** protege tu cuenta de administrador aunque te roben la contraseña.
**Costo:** gratis.
**Pasos (esto es lo que sí te protege a ti):**
1. Entra a **https://myaccount.google.com** con tu cuenta de dueño.
2. **Seguridad** → **Verificación en dos pasos** → **Activar**.
3. Elige método (app de autenticación o mensaje) y sigue las instrucciones.

---

## 2. Registro ante la SIC (RNBD) — Ley 1581 de 2012 — **NO es para ahora**
**Conclusión:** mientras estás **validando la idea, sin empresa constituida**, **NO
registres el RNBD** y **no es un bloqueante**. No puedes registrar una empresa que
legalmente aún no existe, y además el registro del RNBD aplica sobre todo a
**personas jurídicas (sociedades/entidades) con activos altos (> 100.000 UVT)** y a
entidades públicas — no a una persona natural probando una idea.

**Lo que SÍ debes cumplir desde ya** (la Ley 1581 aplica aunque no registres el RNBD):
- Tener **política de privacidad / aviso de tratamiento** (ya está en la app).
- **Pedir consentimiento** con evidencia (ya lo hace la app).
- **Proteger los datos** (seguridad — ya reforzada).

**Secuencia correcta (cuándo sí toca el RNBD):**
1. **Ahora:** no registres nada. Sigue probando. (Solo el punto 3, visto bueno legal, conviene.)
2. **Si la idea funciona y decides formalizar:** crea la empresa en **Cámara de Comercio**
   (ahí "LOTIC Soluciones" pasa a ser real y obtienes el **NIT** en la DIAN).
3. **Ya con empresa:** evalúa si superas el umbral (activos > 100.000 UVT). Si lo superas
   → registras el RNBD en https://www.sic.gov.co; si no, normalmente **no es obligatorio**.
> No soy abogado y las reglas/umbrales de la SIC cambian. Confírmalo con un abogado o
> directamente con la SIC cuando vayas a formalizar.

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
