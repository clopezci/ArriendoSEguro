# Continuidad del proyecto — ArriendoSeguro

> **Documento vivo para agentes y humanos.** Objetivo: que cualquier sesión nueva retome el trabajo sin perder contexto.  
> **Última actualización:** 2026-06-03 (reglas Firestore/Storage versionadas, rate-limit Upstash, páginas Acerca de / Contacto, dominio canónico `arriendoseguro.app`, banner de consentimiento de cookies con Consent Mode v2 + política de cookies).

---

## 1. Cómo usar este documento (nuevo agente)

### Nombre del archivo

| Uso | Ruta |
|-----|------|
| **Documento principal (léelo completo)** | `web/docs/continuidad-proyecto.md` |
| **Entrada rápida en Cursor** | `AGENTS.md` (raíz del repo) |

### Qué decirle al agente en un chat nuevo

Copia y pega (ajusta la tarea entre corchetes):

```
Eres el agente de ArriendoSeguro. Antes de tocar código:
1. Lee web/docs/continuidad-proyecto.md (estado, pendientes, docs clave).
2. Respeta las reglas .cursor/rules/arriendoseguro-*.mdc.
3. Trabaja en main salvo que yo pida otra rama.
4. Al cerrar la tarea: actualiza la bitácora y la fecha en continuidad-proyecto.md;
   si cerraste un hito de roadmap, actualiza también web/docs/roadmap.md.
5. Antes de dar por cerrado: npm run build en web/ y ReadLints en archivos tocados.

Mi tarea ahora: [describe aquí]
```

### Protocolo de actualización (obligatorio para el agente)

Al **terminar** una sesión con cambios relevantes (código, docs de producto, deploy):

1. **Este archivo** — actualizar «Última actualización» y añadir **una fila** en §10 Bitácora.
2. **§8 Estado actual** — marcar ítems hechos o mover pendientes si cambió el panorama.
3. **`web/docs/roadmap.md`** — solo si se cerró o avanzó un hito explícito del tablero (convención `[x]` / `[~]` / `[ ]`).
4. **No** duplicar párrafos largos: la bitácora es resumen; el detalle vive en commits y en docs específicos.

Si la sesión fue solo una pregunta sin cambios en repo, **no** hace falta actualizar.

---

## 2. Qué es ArriendoSeguro

**Propuesta de valor:** arrendar seguro, de persona a persona, **sin agencia al medio**, con trazabilidad, plantillas y reputación visible para decidir con confianza.

**Público:** arrendadores y arrendatarios en **Colombia** (lenguaje cotidiano: *canon, arriendo, inmueble, contrato*; tuteo respetuoso en UI).

**Alcance legal (copy):** la app **organiza, plantilla, firma, inventario y trazas** — **no** es asesoría legal sustitutiva. Referencias a Ley 820 (vivienda urbana), Ley 1581 (datos), Ley 527 (mensajes de datos) de forma **general**; un abogado debe validar plantillas.

**Dinero:** el registro de pagos del canon es **informativo** (no recauda el arriendo por la plataforma en esta fase). Plan **Plus** cobra por **acceso a expedientes/contratos** vía pasarela (Wompi), no el canon.

**Orden de módulos (producto):** cuenta → expediente/contrato → inventario → pagos informativos → reputación (tras cierre) → marketplace (futuro). No mezclar fases.

**Producción:** https://arriendoseguro.app (dominio canónico; el subdominio `arriendoseguro.vercel.app` queda como respaldo)  
**Repo:** https://github.com/clopezci/ArriendoSEguro (rama habitual: `main`)

---

## 3. Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 15 App Router, React, TypeScript, Tailwind |
| Hosting | Vercel (**Root Directory = `web`**) |
| Auth (cliente) | Firebase Auth (correo/contraseña) |
| Datos | Firestore (+ Firebase Storage para PDFs/soportes) |
| Admin / APIs | Firebase Admin SDK **solo** en `app/api/**/route.ts` con `runtime: "nodejs"` |
| Email | Resend (`web/src/services/email/`) + `email_logs` |
| Pagos Plus | Wompi (integración en curso) |
| PWA | `manifest.webmanifest`, `public/sw.js`, registro en layout |
| Validación | Zod en servidor (y UI donde aplique) |

**Variables sensibles:** nunca commitear `.env.local` ni JSON de cuenta de servicio. Ver `web/.env.example`.

---

## 4. Estructura del repositorio

```
ArriendoSeguro/
├── AGENTS.md                 ← puntero para Cursor
├── README.md                 ← visión general
├── .cursor/rules/            ← reglas persistentes del agente (LEER)
├── web/                      ← TODA la aplicación
│   ├── src/app/              ← rutas Next (páginas + API)
│   ├── src/components/       ← UI
│   ├── src/domain/           ← lógica de negocio (contratos, Colombia, pagos…)
│   ├── src/services/         ← email, etc.
│   ├── src/hooks/
│   ├── public/               ← sw.js, manifest, estáticos
│   └── docs/                 ← documentación operativa
└── (docx académicos en raíz: PUV, instrucciones)
```

**Dominios importantes en código:**

| Área | Ruta orientativa |
|------|------------------|
| Plantillas contrato | `web/src/domain/contracts/` (`contractClauses.ts`, `contractVariables.ts`, `v2026-2/`) |
| Validación documentos CO | `web/src/domain/colombia/document-validation.ts` |
| Dirección estructurada | `web/src/domain/colombia/structured-address.ts` |
| Versionado / hash PDF | `web/src/domain/contracts/contractVersioning.ts` |
| Firma + OTP | `web/src/app/api/signatures/`, `web/src/app/firma/[token]/` |
| Plan Plus / Wompi | `web/src/domain/platform-payments/`, `web/docs/payments-wompi.md` |
| Auditoría | `audit_logs` vía `auditEvent` / `audit-server` |
| Errores Firebase en español | `web/src/lib/firebase-errors.ts` |

---

## 5. Rutas principales (mapa rápido)

| Ruta | Propósito |
|------|-----------|
| `/` | Landing pública + encuesta (CTA) |
| `/encuesta`, `/entiendelo-facil` | Validación mercado / ayuda |
| `/ingresar`, `/crear-cuenta`, `/registro` | Auth |
| `/panel`, `/dashboard/*` | Área autenticada (expediente, wizard contrato) |
| `/dashboard/contracts/[id]/*` | Pasos del wizard (landlord, tenant, property, …) |
| `/firma/[token]` | Firma por enlace (partes externas) |
| `/admin` | Panel operador (encuestas, accesos, expedientes) |
| `/legal/*` | Términos, privacidad, firma electrónica |
| `/blog`, `/blog/[slug]` | SEO contenido |
| `/dashboard/plans`, billing | Plan Plus |

Wizard típico: consentimiento → tipo contrato → partes → inmueble → términos → servicios → cláusulas especiales → preview → firma → inventario → pagos → evidencia/novedades.

---

## 6. Historia del proyecto (cronología resumida)

| Periodo | Hito |
|---------|------|
| Fase 0 | Landing, encuesta, admin encuestas, auth Firebase, legales footer |
| Fase 1 núcleo | Wizard contrato `AS-LEASE-MVP-2026.1`, PDF, inventario, pagos informativos, firma simple, panel admin |
| SEO | Blog, sitemap, GA4 opcional, Search Console |
| AS-LEASE-2026.2 | Bloques 1–11: consentimiento, anotaciones, selector tipo, cláusulas especiales, crédito, OTP firma, evidencia ZIP/PDF, notaría, novedades, flag activación template |
| Bloques 12–13 (parcial) | Upload URL soportes codeudor; aviso privacidad resumido (falta 2026.2 completo + baja cuenta) |
| Operación | Fixes Vercel build, SW sin cache HTML viejo, guía deploy |
| Monetización | Plan Plus + Wompi en integración; precio configurable en admin (`app_settings/plan_plus_pricing`); cupos extra testers |
| PWA | Manifest + SW + botón landing + **banner global** en layout (excepto `/`) |

---

## 7. Estado actual — hecho / en curso / pendiente

### ✅ Hecho (producción o `main` estable)

- Validación mercado: landing, encuesta, admin CSV.
- Wizard completo vivienda urbana + PDF + hash versión plantilla.
- Inventario, acta entrega, pagos informativos + anexo PDF + recordatorios.
- Firma con token, `audit_logs`, evidencia ampliada (Bloque 7), constancia PDF.
- Hub evidencia, ZIP con límites, anexo pagos PDF (Bloque 8).
- Notaría opcional, novedades con email (Bloques 9–10).
- Template `AS-LEASE-2026.2` activable por env `NEXT_PUBLIC_LEASE_TEMPLATE_2026_2_ENABLED`.
- Blog SEO, tema claro violeta, errores auth en español.
- Email service + plantillas (mock o Resend según env).
- Precio Plan Plus desde admin; checkout alineado al monto de orden.
- PWA: manifest, SW (estáticos cacheados, HTML/API sin cache-first agresivo), instalación landing + banner sitio.
- Documentos legales para abogado y plan de mejoras en `web/docs/`.
- **Seguridad de datos:** reglas versionadas `web/firestore.rules` + `web/storage.rules` + `web/firebase.json` (modelo *deny-all* al cliente; todo el acceso es server-side con Admin SDK; no hay imports de `firebase/firestore` ni `firebase/storage` en cliente). Desplegar con `firebase deploy --only firestore:rules,storage:rules`.
- **Cabeceras de seguridad + CSP** de producción ya configuradas en `web/next.config.ts` (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, CSP con orígenes mínimos de Firebase/Turnstile/GA).
- **Rate-limit** de endpoints públicos (`/api/leads`, `/api/contact`, `/api/signatures/request-otp`) vía `src/lib/security/rate-limit.ts` (Upstash Redis con *fallback* en memoria).
- **Páginas Acerca de (`/acerca-de`) y Contacto (`/contacto`)** con formulario → email (Resend) + `contact_messages`; enlazadas en footer y sitemap (requisito de transparencia para AdSense).
- **Historial crediticio:** orientación + enlaces a MiDatacrédito y BDME en el wizard (sin cargar archivos en la app); ver `credit-history-guidance-block.tsx`.
- **Baja de cuenta:** `/api/cuenta/eliminar` + `/dashboard/cuenta/eliminar` operativos (parte del Bloque 13).
- **Dominio canónico** `arriendoseguro.app` en metadata/sitemap (`NEXT_PUBLIC_APP_URL`).
- **Observabilidad propia (en vez de Sentry):** `ClientErrorReporter` captura errores del navegador → `error_events` (agregados por huella); usuarios reportan en `/reportar` → `user_reports`; el admin los gestiona en pestañas **Reportes** y **Errores** de `/admin`. Cero costo, datos en Firebase, PII enmascarada. Permisos de testing ya existen (otorgar Plus / cupos en `/admin`).
- **Consentimiento de cookies (CMP propia):** banner con Google **Consent Mode v2** (`ConsentMode` + `CookieConsentBanner`), categorías necesarias/analítica/publicidad, reabrible desde footer («Preferencias de cookies»), política en `/legal/cookies`. GA4 solo mide tras consentimiento; listo para gatear AdSense.

### 🔄 En curso / parcial

| Ítem | Detalle |
|------|---------|
| **Bloque 12** codeudor | ✅ Completo: APIs (upload-url/confirm/download-url/delete/list, rol landlord forzado en servidor), UI `CodebtorSupportsPanel`, ZIP evidencia y `storage.rules`. Auditado 2026-06-03 |
| **Bloque 13** privacidad | ✅ `AVISO-PRIV-2026.2` completo (encargados incl. Upstash, transferencia internacional, derechos, cookies/Consent Mode) y eliminación de cuenta operativa. Solo falta poner razón social/NIT cuando te formalices |
| **Wompi** | Webhook producción, reconciliación, mensajes bloqueo sin plan |
| **PWA** | Íconos 192/512 maskable finales, splash iOS, pruebas dispositivo real |
| **Firestore rules** | Baseline *deny-all* versionado y seguro; **falta desplegarlo** (`firebase deploy`) y confirmar en consola |
| **Upstash** | Variables `UPSTASH_REDIS_REST_*` por configurar en Vercel (sin ellas, rate-limit usa memoria best-effort) |
| **AdSense** | CMP de cookies ✅; blog ampliado a 15 artículos con fuentes reales ✅; Search Console **scaffold listo** (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → pegar token en Vercel). Faltan: separar ads solo en páginas públicas, alta en AdSense |
| **Legal abogado** | ✅ Confirmado **sin cambios**: `AS-LEASE-2026.2` queda tal cual (2026-06-03) |

### ⏳ Pendiente prioritario (orden sugerido)

1. **Desplegar** las reglas Firestore/Storage versionadas y verificarlas en consola; configurar `UPSTASH_REDIS_REST_*` en Vercel.
2. Cerrar confirmaciones abogado → versión contractual definitiva 2026.2.
3. Bloque 12 (Storage codeudor UI/confirm/download) + `AVISO-PRIV-2026.2` completo **antes** del marketing masivo.
4. Wompi en producción con webhook verificado.
5. AdSense: ampliar blog, CMP de cookies, Search Console; conectar Resend con dominio verificado (deliverability).
6. Íconos PWA + QA instalación Android/iOS.
7. **No iniciar** reputación pública ni marketplace hasta cerrar prio 1–4 de Fase 2.

### 🔮 Mejoras futuras (backlog, no implementar sin plan)

- ~~Reputación y calificaciones post-cierre (Fase 3)~~ ✅ implementado (calificación bidireccional por estrellas + resumen privado). Pendiente: disputas/revisión y retención.
- Marketplace ligero (Fase 4).
- Pasarela que recaude canon (producto distinto; fuera de fase actual).
- Sentry / panel errores.
- KPIs funnel automatizados en admin.
- Calendario editorial blog ampliado.
- Autenticación notarial digital con aliado (hoy manual).
- Estudio de crédito con aliado real (hoy link o “próximamente”).

---

## 8. Documentos clave (leer según la tarea)

| Documento | Cuándo usarlo |
|-----------|----------------|
| [roadmap.md](./roadmap.md) | Tablero visual fases; mantener `[x]`/`[~]`/`[ ]` |
| [plan-mejoras-contrato-flujo.md](./plan-mejoras-contrato-flujo.md) | Detalle Bloques 1–13, AS-LEASE-2026.2 |
| [checklist-firebase-vercel-operacion.md](./checklist-firebase-vercel-operacion.md) | Deploy, env vars, Firebase, Vercel §0 |
| [payments-wompi.md](./payments-wompi.md) | Integración pagos Plus |
| [email-resend-setup.md](./email-resend-setup.md) | Email transaccional |
| [guia-camara-comercio-virtual.md](./guia-camara-comercio-virtual.md) | Formalización del emprendimiento (RUT + Cámara de Comercio, virtual) |
| [acciones-manuales-fundador.md](./acciones-manuales-fundador.md) | **Tareas que solo el fundador puede hacer** (deploy reglas, env Vercel, Resend, Search Console, AdSense) |
| [legal-abogado/analisis-comparativo.md](./legal-abogado/analisis-comparativo.md) | Comparativa plantilla vs abogado |
| `contrato-vivienda-urbana-revision-legal.txt` | Texto plano para revisión legal |
| [web/README.md](../README.md) | Arranque local, tests, Firebase |
| [vercel.README.md](../vercel.README.md) | Notas deploy |
| `web/src/domain/contracts/v2026-2/README.md` | Notas versión 2026.2 en código |

**Reglas Cursor (siempre aplicar según glob):**

- `.cursor/rules/arriendoseguro-colombia.mdc` — PUV, Habeas data, orden módulos
- `.cursor/rules/arriendoseguro-roadmap.mdc` — fases y qué no mezclar
- `.cursor/rules/arriendoseguro-quality-launch.mdc` — build, seguridad, auditoría
- `.cursor/rules/arriendoseguro-next-web.mdc` — convenciones Next/API
- `.cursor/rules/arriendoseguro-mobile-pwa.mdc` — mobile-first, PWA

---

## 9. Colecciones y settings Firestore (referencia)

> Nombres orientativos; ver código antes de asumir esquema completo.

| Colección / doc | Uso |
|-----------------|-----|
| `lead_forms` | Respuestas encuesta |
| `contracts` | Expedientes de arriendo |
| `contracts/{id}/novedades` | Solicitudes/novedades |
| `contracts/{id}/codebtor_supports` | Metadatos soportes codeudor |
| `audit_logs` | Eventos críticos (firma, pago, plan…) |
| `email_logs` | Envíos transaccionales |
| `access_entitlements` | Plan Plus / demo / límites expedientes |
| `app_settings/plan_plus_pricing` | Precio vigente Plus (`promo_49900`, `list_89900`, `custom`) |
| `platform_payment_orders` | Órdenes Wompi (ver dominio pagos) |

**Admin:** panel en `/admin` — no exponer credenciales; operaciones sensibles vía API con Admin SDK.

---

## 10. Bitácora de sesiones (actualizar al cerrar)

| Fecha | Agente / nota | Resumen | Commit(s) |
|-------|---------------|---------|-----------|
| 2026-06-03 | Claude Code | Accesibilidad AA (parcial): foco visible global, «saltar al contenido», `prefers-reduced-motion`, foco en `.input`; contraste de etiquetas corregido en header y legales públicas. Falta auditoría Lighthouse/axe e internas. | `(commit a11y)` |
| 2026-06-03 | Claude Code | Posventa + KPIs: **embudo de conversión** en `/admin`; **servicio SMS** (`services/sms`, Twilio o mock); **recordatorios de terminación/renovación** (opt-in en paso Términos + tarjeta `/alertas`, cron `api/contracts/renewal-reminders/send-due` con `CRON_SECRET`, email+SMS a 3m+2sem y 3m+1sem antes del fin); novedades/daños ahora también por SMS. Dominio `renewalReminder` + tests (52/52). | `(commit posventa)` |
| 2026-06-03 | Claude Code | Reputación: **derecho de réplica** (`/api/reputation/reply`, motivo cerrado + texto breve) para la persona calificada; calificación recibida ahora **visible a su titular** para poder replicar; reconfirmado acceso solo a partes del contrato (`requireContractParticipant`). | `(commit replica)` |
| 2026-06-03 | Claude Code | **Fase 3 — Reputación**: calificación bidireccional por estrellas (sin texto libre), variables según dirección (arrendador↔arrendatario), tras cierre, anti-represalia, resumen privado en `/dashboard/reputacion`. APIs `reputation/submit|for-contract|summary`, dominio `reputation/criteria`, `StarRating`, +5 tests (48/48). Abogado: `AS-LEASE-2026.2` confirmado **sin cambios**. | `(commit reputacion)` |
| 2026-06-03 | Claude Code | Captura de errores de **servidor** (`logServerError` → `error_events`, reutiliza `recordErrorEvent`) cableada en webhook Wompi, generación de PDF y firma; refactor del endpoint de cliente para compartir la lógica. Completa la observabilidad propia. | `(commit obs-servidor)` |
| 2026-06-03 | Claude Code | Observabilidad propia (alternativa a Sentry, $0): captura automática de errores de cliente (`error_events`, agregada por huella), reportes de usuario (`/reportar` → `user_reports`) y pestañas **Reportes**/**Errores** en `/admin` (cambiar estado, marcar resuelto). PII enmascarada, datos en Firebase. Wompi aparcado (hub vive en `/wompi`, hecho para Supabase). | `(commit observabilidad)` |
| 2026-06-03 | Claude Code | Auditoría Bloque 12 (soportes codeudor): ya estaba completo y seguro (rol landlord forzado en servidor, verificación en Storage, ZIP evidencia, storage.rules). Marcado `[x]`; +6 tests de validación de ruta `storage-path` (43/43). | `(commit bloque12)` |
| 2026-06-03 | Claude Code | Blog ampliado a 15 artículos (9 nuevos) con datos reales verificados y bloque `sources` con enlaces oficiales (Ley 820, IPC 2025 DANE, Ley 527/Decreto 2364, Ley 1266/1581, CGP art. 384). Nuevo tipo de bloque `sources` en `types.ts` + renderer. | `(commit blog)` |
| 2026-06-03 | Claude Code | Doc de acciones manuales del fundador (`acciones-manuales-fundador.md`). `AVISO-PRIV-2026.2` completado (sección cookies/Consent Mode + encargado Upstash). **CI** GitHub Actions (lint+test+build). Arreglado test preexistente roto (`server-only` no resolvía en `tsx`; ahora `--conditions=react-server` + dep) y +5 tests de rate-limit (37/37). | `(commit priv+CI)` |
| 2026-06-03 | Claude Code | Search Console scaffold (`verification.google` vía `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`); seguridad #3: correo de bypass de dedup ya no va hardcodeado (solo `LEAD_FORM_DEDUP_BYPASS_EMAILS`). | `1ba12f2` |
| 2026-06-03 | Claude Code | Banner de consentimiento de cookies (Consent Mode v2): `ConsentMode`, `CookieConsentBanner`, `CookiePreferencesLink` (footer), `/legal/cookies`, helper `lib/consent/cookie-consent.ts`; GA4 gateado por consentimiento. | `d677b2f` |
| 2026-06-03 | Claude Code | Seguridad #1: reglas `firestore.rules`/`storage.rules`/`firebase.json` versionadas (deny-all cliente). Rate-limit Upstash+memoria en `/api/leads`, `/api/contact`, `/api/signatures/request-otp`. Páginas `/acerca-de` y `/contacto` (form→Resend, `contact_messages`) + footer + sitemap. Dominio canónico `arriendoseguro.app`. Guía Cámara de Comercio. Docs sincronizadas (CSP/headers, créditos, baja de cuenta ya estaban hechos). | `a38af5d` |
| 2026-06-02 | Cursor | Banner PWA global (`PwaInstallSiteBanner` en layout), hook `usePwaInstall`, oculto en `/`; precio Plus admin y cupos testers en commits previos | `a107b32`, `519513b`, `6533edc`, `9486a0d` |
| 2026-05-13 | (histórico) | Bloques 7–11 evidencia/firma/activación 2026.2; roadmap actualizado | ver `git log` desde `723dbfb` |

*Añade filas nuevas arriba de esta tabla (más reciente primero).*

---

## 11. Comandos y calidad antes de cerrar

```bash
cd web
npm install          # si hace falta
npm run dev          # local :3000
npm run build        # obligatorio antes de entregar
npm test             # reglas rent-law y similares
```

**Checklist agente (regla quality-launch):**

- [ ] `npm run build` sin errores en `web/`
- [ ] `ReadLints` sin issues nuevos en archivos tocados
- [ ] Copy en español Colombia con tildes y `¿` `¡`
- [ ] Si tocaste contrato/plantilla: `contractVersion` + trazabilidad hash
- [ ] Si tocaste datos personales/pagos: nota en commit/PR
- [ ] Commit/push solo si el usuario lo pidió

**Problema conocido Windows:** si `npm run build` falla con `EINVAL readlink .next`, borrar `web/.next` y reintentar.

---

## 12. Decisiones ya tomadas (no reabrir sin motivo)

- Trabajar en **`main`** por defecto (no ramas `feat/` salvo petición).
- Admin SDK **nunca** en componentes cliente.
- Pagos de canon = informativos; cobro plataforma = Plan Plus / entitlements.
- Plantilla activa MVP sigue; 2026.2 con feature flag hasta validación abogado.
- Service worker: **no** cache-first en HTML de navegación (evita landings viejas en producción).
- Banner instalar PWA en todas las páginas excepto `/` (landing tiene sección dedicada).
- Precio checkout Plus = monto de la orden en Firestore, no constante hardcodeada.
- **Acceso a datos solo server-side:** el cliente NO usa `firebase/firestore` ni `firebase/storage`; reglas en *deny-all* y todo pasa por Admin SDK en `route.ts`. Si algún día se lee desde cliente, abrir colección por colección con `request.auth` + pertenencia.
- **Dominio canónico** = `arriendoseguro.app` (no usar el de vercel en metadata/SEO).
- **Rate-limit** centralizado en `src/lib/security/rate-limit.ts` (Upstash si hay env; si no, memoria best-effort). Fail-open ante caída de Redis.

---

## 13. Contactos y canales (producto)

- Privacidad / Habeas Data (planeado en Bloque 13): `privacidad@arriendoseguro.com.co`
- Deploy / cuenta Vercel: `clpezci@gmail.com` (ver checklist)

---

## 14. Enlaces externos útiles

- [Firebase Console](https://console.firebase.google.com/)
- [Vercel Dashboard](https://vercel.com/)
- Producción: https://arriendoseguro.vercel.app/

---

*Fin del documento. Mantén las secciones 7, 10 y la fecha del encabezado como fuente de verdad del «ahora»; el resto cambia con menos frecuencia.*
