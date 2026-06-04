# Continuidad del proyecto — ArriendoSeguro

> **Documento vivo para agentes y humanos.** Objetivo: que cualquier sesión nueva retome el trabajo sin perder contexto.  
> **Última actualización:** 2026-06-04 (Epic QR/2-bloques en curso — Etapa A1: carga real de soporte de pago a Firebase Storage vía URL firmada, reemplaza el placeholder `mock://`, base del enlace del inquilino; andamiaje de proveedor de firma Firma.dev; aliados de terceros: directorio administrable con correos ocultos, botón Contactar → lead por correo, doble confirmación tokenizada aliado/usuario para control de comisiones anti-fraude; exportación discreta de pagos: CSV + "Certificado de pagos registrados" PDF por año, neutral —sin terminología tributaria— en el expediente; alertas proactivas de errores por correo —umbral mínimo configurable desde `/admin`, cron `error-alert/send-due`— y página pública de estado `/estado` con incidentes administrables; PWA pulida + accesibilidad AA: manifest completo, íconos SVG (any+maskable), service worker con fallback offline, viewport/theme-color/appleWebApp, diálogo con Escape y foco, checklist de Lighthouse; reputación profundizada: agregado privado por persona, anti-fraude flag-only y consulta con consentimiento Habeas Data —revisar con abogado antes de publicitar—; programa de referidos "Invita y gana": enlace por usuario, descuento configurable desde `/admin` —50% por defecto— y aprobación manual por referido; semáforo legal en vivo + "Sello de cumplimiento Ley 820" en el paso de revisión; borradores en servidor para retomar desde cualquier dispositivo; bloque de gobernanza admin: IPC editable desde `/admin` y leído por la calculadora, recordatorio anual en enero que se apaga al confirmar, precio del Plan Plus con precio vigente + lista tachada editables; calculadoras públicas con SEO).

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
| **Modelo gratis/pago** | ✅ Completo: crear gratis, watermark+CTA (% del valor, contrato guardado limpio), gate de firma + posventa (novedades/alertas/soportes/evidencia/pagos/inventario), PDF de descarga marcado, cláusula de garantía Art. 15 en el contrato, copy "gratis" en landing/entiéndelo y demo actualizado. Todo apagable con `NEXT_PUBLIC_FREE_TIER_ENABLED` |
| **Firma con proveedor (Firma.dev)** | Próximo: integrar Firma.dev (asequible, escalable) tras una abstracción para poder cambiar de proveedor. Ver acciones en `acciones-manuales-fundador.md` §7c |
| **Garantía de servicios públicos (Art. 15 Ley 820)** | ✅ Implementada en el paso **Servicios** (`UtilityGuaranteeSection`): checkbox, 2 últimas facturas, **máximo** en vivo (≤ suma de 2 períodos), validación y **aceptación con captura de IP/UA + auditoría** (`/api/contracts/utility-guarantee/accept` → `utility_guarantee_acceptances`). Se muestra en el Resumen. Dominio `utilityGuarantee` + tests (59/59) |

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
| 2026-06-04 | Claude Code | **Epic QR/2-bloques — Etapa C (codeudor múltiple, aditivo, 3 slices):** **C1 generación** (`solidaryCoDebtors[]` en input/draft; `codebtorBlocks` repite bloques de plantilla con sufijos `_2,_3`; variables y renders MVP+v2026-2; validación y api-types). **C2 firma** (`SignaturePartyType`/`ContractParticipantRole` + `solidaryCoDebtor_2..5`; `requiredParties` por cantidad; `personForParty` por índice; `serverAuth` roles; novedades correo/SMS + etiquetas). **C3 UI** (`AdditionalCodebtorsManager` "agregar otro codeudor"; la revisión lista todos). El flujo de un solo codeudor queda idéntico. 138/138. | `(este)` |
| 2026-06-04 | Claude Code | **Epic QR/2-bloques — Etapas A2 + B:** **A2)** subida real de **documentos de propiedad/poder** a Storage (dominio `property-documents` + rutas `api/contracts/property-documents/{upload-url,confirm,list,download-url}` + `PropertyDocumentsPanel` + página `documentos-propiedad` en el hub de evidencias; destraba el botón placeholder del paso inmueble). **B)** pregunta inicial **dueño vs apoderado** en el paso de tipo de contrato (`actingAs` + `proxyDeclarationAcceptedAt` en el draft, `setActingAs`); si apoderado, juramento + compromiso de subir el poder, con recordatorio en la revisión y en `documentos-propiedad`. +4 tests (128/128). | `(este)` |
| 2026-06-04 | Claude Code | **Epic QR/2-bloques — Etapa A1 (carga real de soporte de pago):** el soporte de pago ya **se sube a Firebase Storage** vía URL firmada (`api/payments/support/upload-url` + `download-url`, patrón de codebtor-supports, Plus-gated), reemplazando el placeholder `mock://`. La página de registro de pago sube el archivo (PUT) antes de crear el pago. Base para el enlace del inquilino (QR). Plan por etapas A→E documentado; A1 hecha. 124/124. | `(este)` |
| 2026-06-04 | Claude Code | **Andamiaje de proveedor de firma (Firma.dev listo para enchufar):** abstracción `domain/signatures/provider` (interfaz `SignatureProvider`, proveedor **interno** actual, **stub Firma.dev** y factory por `SIGNATURE_PROVIDER`; sin llaves cae al interno, no cambia nada). Guía de obtención de llaves en `acciones-manuales-fundador.md §7c`. Aliados de prueba ajustados a seguro/cobranza/jurídica(legal)/estudio de crédito. +5 tests (124/124). | `(este)` |
| 2026-06-04 | Claude Code | **Aliados (servicios de terceros) con control de comisiones anti-fraude:** dominio puro `partners` (categorías, validación, `deriveLeadOutcome`, siembra de prueba). Directorio administrable desde `/admin` (`api/admin/partners` CRUD con **correos ocultos** + siembra si vacío; `api/admin/partner-leads` control de comisión). Usuario: `/dashboard/aliados` con directorio (`api/partners/active`, sin correos) y modal Contactar → `api/partners/lead` que envía el lead a los correos del aliado + acuse al usuario, ambos con **enlaces de confirmación tokenizados** (`api/partners/lead/confirm`). **Doble confirmación** (aliado + usuario) cierra el ciclo; si el aliado niega pero el usuario confirma → disputa con evidencia del usuario. Plantillas `partnerLeadEmail`/`partnerLeadAckEmail`; enlace en Planes y nav. +10 tests (119/119). | `(este)` |
| 2026-06-04 | Claude Code | **Exportación discreta de pagos (gancho de Plus, sin costo):** dominio puro `paymentsCertificate` (filtro por año, CSV con BOM/escape, certificado HTML **neutral** sin terminología tributaria; si no hay pagos, sale vacío). Rutas `api/payments/export-csv` (CSV) y `api/payments/certificate` (PDF reusando el motor del contrato), ambas con `requireContractParticipant`. Tarjeta discreta `PaymentsExportCard` en la página de pagos (selector de año + CSV + certificado). +7 tests (109/109). | `(este)` |
| 2026-06-04 | Claude Code | **Alertas proactivas de errores + página de estado (sin costo, alternativa a Sentry/StatusPage):** dominio `observabilityConfig` (umbral mínimo 1, ventana, cooldown; tolerante por campo) + cron `api/observability/error-alert/send-due` que avisa por correo a admins cuando hay errores recientes sin resolver sobre el umbral. Página pública `/estado` (chequeos en vivo de app/BD/correo + incidentes) vía `api/status`; incidentes y config administrables (`api/admin/status-incidents`, `api/admin/observability-config`) con tarjeta en `/admin`. Footer + sitemap + manual (programar el cron cada 5–15 min). +7 tests (102/102). | `(este)` |
| 2026-06-04 | Claude Code | **PWA pulida + accesibilidad AA (calidad técnica, sin costo):** `manifest.webmanifest` completo (id, scope, lang, categories, orientation, colores claros, theme #6d28d9); íconos SVG `icon.svg` (any) y `maskable.svg` (zona segura) + PNG 512; service worker network-first con **fallback offline** (`offline.html` precacheado); `export const viewport` (theme-color/colorScheme) + `appleWebApp` + apple-touch-icon; diálogo PWA con **Escape** y foco al abrir; `aria-label` en inputs sueltos. Doc `checklist-lighthouse-accesibilidad.md` para correr Lighthouse. 95/95. | `(este)` |
| 2026-06-04 | Claude Code | **Reputación: agregado + anti-fraude + portabilidad con consentimiento (moat, Habeas Data):** dominio puro `aggregate` (promedio histórico por persona, refactor de `summary`) y `antifraud` (señales flag-only: mismo par en varios contratos, ráfagas). `aggregate-store` mantiene `reputation_aggregates` y `reputation_flags` al calificar. Consulta con consentimiento: `lookup/request` (avisa al titular por correo), `lookup/pending`, `lookup/respond` (autoriza/rechaza con evidencia IP/UA), `lookup/result` (solo agregado, nunca detalle). UI en `/dashboard/reputacion` (titular + solicitante) y tarjeta de señales en `/admin`. **Pendiente: revisión de abogado antes de publicitar la consulta.** +5 tests (95/95). | `(este)` |
| 2026-06-04 | Claude Code | **Programa de referidos "Invita y gana" (bucle de crecimiento, sin costo):** dominio puro `referrals` (config, validación de código, descuento, reglas de registro). Cada usuario tiene código/enlace (`api/referrals/me`), el invitado lo reclama tras login y queda **pendiente** (`api/referrals/claim`, `ReferralTracker` captura `?ref=` y reclama). El fundador fija **% de descuento (50% por defecto)** y **aprueba por referido** desde `/admin` (`api/admin/referral-config`, `api/admin/referrals`). El referido aprobado ve el Plan Plus con descuento (Planes) y la tarjeta `ReferralPanel`. Cobro manual: el fundador aplica el descuento al conceder Plus. +7 tests (90/90). | `(este)` |
| 2026-06-04 | Claude Code | **Semáforo legal en vivo + Sello de cumplimiento Ley 820 (moat legal visible, sin costo):** dominio puro `legalCompliance` que separa **validaciones en vivo** (canon vs. tope 1% art. 18, garantía servicios ≤ 2 períodos art. 15) de **cumplimiento por diseño** (sin depósito art. 16, reajuste limitado al IPC art. 20, mora ≥ 2 meses art. 22, firma Ley 527). Componente `legal-semaphore` (🟢/🟡/🔴 + sello-resumen). En vivo en el paso de inmueble (canon) y panel-sello en `review` (reemplaza "Alertas legales"). +11 tests (83/83). | `(este)` |
| 2026-06-04 | Claude Code | **Borradores en servidor (resume desde cualquier dispositivo, sin costo):** el wizard sincroniza cada guardado a Firestore `contract_drafts` (dominio `contractDraftSync`, API `api/contracts/drafts` GET/PUT/DELETE con `requireAuthenticatedUser`; el dueño se fija con el uid del token, nunca con el cuerpo). Aditivo a localStorage: `saveDraft` empuja con debounce (`draft-server-sync`, fire-and-forget, salta demos) y `/dashboard/leases` + `useDraftGuard` traen y combinan por recencia ("más reciente gana"). +6 tests (72/72). | `(este)` |
| 2026-06-04 | Claude Code | **Bloque de gobernanza admin (sin costo, baja el riesgo legal y da autonomía al fundador):** IPC del reajuste editable desde `/admin` (`app_settings/legal_config`, dominio `legalConfig`) y la calculadora de reajuste lo **lee** (ya no hardcodeado); **recordatorio anual automático** 2ª semana de enero a los correos de admin (cron `api/legal/ipc-reminder/send-due`, plantilla `ipcUpdateReminderEmail`) que **se apaga al confirmar/actualizar** en `/admin`; **precio del Plan Plus** ampliado a precio vigente + **precio de lista (tachado)** personalizable (`customListCop` en dominio/route/UI); notas "verifica los valores aplicados" en las 3 calculadoras. +7 tests de pricing (66/66). Pendiente fundador: programar el nuevo cron (manual §7b). | `(este)` |
| 2026-06-04 | Claude Code | **Calculadoras públicas** (SEO + conversión, sin costo): `/calculadoras` + reajuste por IPC (5,10 % 2025), canon máximo 1 % y garantía de servicios (Art. 15), reutilizando `rent-law` y `utilityGuarantee`; con metadata, JSON-LD, CTA, sitemap y footer. IPC vigente en `IPC_REFERENCE`. | `(este)` |
| 2026-06-03 | Claude Code | Cierre modelo gratis/pago: copy **"genera tu contrato gratis"** en landing y `/entiendelo-facil` (gateado), y **demo guiado actualizado** (gratis para generar; firma/posventa Plus; menciona alertas, reputación bidireccional y garantía Art. 15). | `(este)` |
| 2026-06-03 | Claude Code | **Cláusula de garantía Art. 15 impresa en el contrato** (abogado validó el marco): `utilityServicesGuarantee` en el payload (`types`/`api-types`/`toContractInput`) y `buildUtilityGuaranteeBlock` con placeholder `[GARANTIA_SERVICIOS_PUBLICOS_CONDICIONAL]` en cláusula 7 de ambos templates (MVP y 2026.2). Solo se imprime si está habilitada y aceptada. 59/59. | `(este)` |
| 2026-06-03 | Claude Code | **Garantía de servicios públicos (Art. 15 Ley 820)** en el paso Servicios: checkbox + 2 últimas facturas + cálculo del máximo (≤ suma de 2 períodos) + validación + **aceptación con captura de IP/UA y auditoría** (`utility-guarantee/accept`, colección `utility_guarantee_acceptances`); visible en el Resumen. Dominio `utilityGuarantee` + 4 tests (59/59). Es la única garantía legal (no el depósito del art. 16). | `(este)` |
| 2026-06-03 | Claude Code | Modelo gratis/pago: **PDF de descarga con marca de agua** (refactor de integridad). La versión **guardada queda LIMPIA** (legal, sin marketing en el hash); la marca+CTA del tier gratis se aplica solo al **mostrar** (`displayHtml` en preview) y al **descargar** (`generate-pdf` marca al renderizar si el usuario no es Plus). Beneficio: al pasar a Plus, el contrato firmado queda limpio. + auth en `generate-pdf` (cierra hueco). Demo conserva su marca. | `(este)` |
| 2026-06-03 | Claude Code | Modelo gratis/pago: gate de **inventario** (`inventory/create`) — añade Plus + **cierra hueco de auth** (antes `createdByUserId: TODO_AUTH_USER`; ahora `requireContractParticipant` y uid real; el cliente envía token). Anotados en plan/manual: **Firma.dev** (§7c) y **garantía de servicios públicos Art. 15** (a implementar en creación). | `(este)` |
| 2026-06-03 | Claude Code | Modelo gratis/pago (incr. 3b — **gate de posventa**): helper `contractPlusGate` (`shouldBlockForPlus`/`plusRequiredResponse`, 402) aplicado a **novedades**, **alertas (renewal-reminder)**, **soportes codeudor (upload)**, **evidencia (ZIP)** y **pagos (create)**. Reputación queda implícita (requiere firmado). **Pendiente:** `inventory/create` (además **no tiene auth** — `TODO_AUTH_USER`, hueco a cerrar) y marca en PDF de descarga; gap de copy en landing/entiéndelo. | `(este)` |
| 2026-06-03 | Claude Code | **Documentos actualizados con el modelo gratis/pago**: `/legal/terminos` §13 reescrita (solo 2 planes: **Gratis** = generar/imprimir contrato; **Plus** = firma+posventa; **aliados** = terceros de pago opcionales, no son planes); `/dashboard/plans` con tarjeta **Gratis**, Plus y **Aliados (opcional, costo aparte)**. | `(este)` |
| 2026-06-03 | Claude Code | Modelo gratis/pago (incr. 3a — **gate de firma**): `signatures/start` ahora **autentica** (cierra hueco: antes no validaba a nadie) con `requireContractParticipant` y **exige Plus o demo** cuando `freeTierEnabled` (free → 402 con CTA a Plus); el preview envía auth y muestra el CTA. **Pendiente (3b):** gatear posventa (novedades/pagos/inventario/evidencia/reputación/alertas/soportes) con Plus + marca en PDF de descarga. | `(este)` |
| 2026-06-03 | Claude Code | Modelo gratis/pago (incr. 1b–2): CTA del watermark con **% del valor total del contrato** (canon×meses vs precio Plus) + prompt de cuenta; **creación gratis** habilitada (`/new` crea borrador `accessStatus:"free"` cuando no hay Plus/demo y `freeTierEnabled`; `AccessStatus` admite `free`; `leases` permite crear y ajusta copy). **Pendiente crítico (incr. 3):** gatear **firma y posventa** con Plus (hoy un usuario free podría firmar) + marca en PDF de descarga. | `aa6cc1c` |
| 2026-06-03 | Claude Code | Modelo **gratis/pago** (incremento 1): flag `freeTierEnabled` (`NEXT_PUBLIC_FREE_TIER_ENABLED`, default on); contrato del tier gratis con **marca de agua `arriendoseguro.app` + CTA enganchador a Plus** (`freeTierWatermark`), aplicado en preview según estado Plus (entitlements). Split definido: gratis = imprimir contrato; firma+posventa = Plus. **Falta** (incrementos sig.): creación gratis en `/new`, CTAs Plus en firma/posventa, marca en el PDF de descarga. | `(commit free-tier-1)` |
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
