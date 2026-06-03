# Roadmap visual — ArriendoSeguro

> Tablero rápido del producto. Mantener sincronizado con la regla
> `.cursor/rules/arriendoseguro-roadmap.mdc`. Última revisión: **2026-06-03** (seguridad: reglas Firestore/Storage versionadas + rate-limit Upstash; páginas Acerca de/Contacto; dominio canónico `arriendoseguro.app`).
>
> Convenciones:
> - **[x]** = listo en producción o en `main`.
> - **[~]** = parcial / en progreso.
> - **[ ]** = pendiente.
> - **(prio)** = orden recomendado dentro de cada fase.

---

## Mapa general

```
[ Fase 0 ]      [ Fase 1 ]      [ Fase 2 ]        [ Fase 3 ]        [ Fase 4 ]
 Validación  →  Contrato +   →  Calidad legal  →  Confianza      →  Crecimiento
 de mercado     expediente      + PWA + cobros    (reputación)      (marketplace)
   ✅ activo     ✅ activo        🔄 en curso        ⏳ por iniciar    ⏳ por iniciar
```

---

## Fase 0 — Validación de mercado ✅

- [x] Landing pública (`/`) con propuesta de valor y CTA a la encuesta.
- [x] Página de ayuda “Entiéndelo fácil” (`/entiendelo-facil`).
- [x] Encuesta de validación con preguntas en español natural y CSV exportable.
- [x] Panel `/admin` con tablero de respuestas (encabezados con texto de la pregunta).
- [x] Auth Firebase (cliente) y Admin SDK solo en `route.ts`.
- [x] Aviso legal y términos básicos en footer.
- [x] Blog orientativo (`/blog`, `/blog/[slug]`) con JSON-LD (Blog / BlogPosting), seis artículos iniciales, `sitemap.xml` y `robots.txt`; GA4 opcional vía `NEXT_PUBLIC_GA_MEASUREMENT_ID` en el layout.
- [x] Enlazado interno desde la landing hacia guías del blog por tema (`BlogTopicLinks` + `landing-topic-links.ts`).
- [x] Páginas **Acerca de** (`/acerca-de`) y **Contacto** (`/contacto`, formulario → Resend + `contact_messages`), enlazadas en footer y sitemap. Transparencia requerida por AdSense.
- [ ] **En fila (SEO/AdSense):** ampliar calendario editorial a ~15 artículos, Search Console (propiedad + sitemap), CMP de consentimiento de cookies para anuncios, validación de datos estructurados en Rich Results y enlaces entrantes.

---

## Fase 1 — Contrato + expediente (núcleo actual) ✅

### Wizard del contrato de vivienda urbana
- [x] Datos del arrendador (`landlord/page.tsx`).
- [x] Datos del arrendatario (`tenant/page.tsx`).
- [x] Codeudor solidario opcional (`codebtor/page.tsx`).
- [x] Datos del inmueble y validación de canon legal (`property/page.tsx`).
- [x] Términos del arriendo (`terms/page.tsx`).
- [x] Servicios públicos y administración (`utilities/page.tsx`).
- [x] Vista previa y descarga PDF (`preview/page.tsx`).

### Plantilla legal y trazabilidad
- [x] Versión `AS-LEASE-MVP-2026.1` (`contractClauses.ts`).
- [x] Bloques condicionales para codeudor.
- [x] Variables dinámicas centralizadas (`contractVariables.ts`).
- [x] Hash SHA-256 por documento (`contractVersioning.ts`).

### Inventario y entrega
- [x] Inventario inicial guiado por zonas.
- [x] Acta de entrega en PDF.

### Pagos informativos
- [x] Registro de pagos (informativo, no recauda).
- [x] Anexo de bitácora de pagos en PDF.
- [x] Recordatorios de pago próximos al vencimiento (cron / endpoint).

### Firma electrónica simple
- [x] Token único por firmante (`firma/[token]/page.tsx`).
- [x] Bitácora en `audit_logs` y anexo de evidencia.

### Panel administrativo
- [x] Vista de encuestas, accesos, expedientes y auditoría.
- [x] Export CSV con etiquetas legibles.

---

## Fase 2 — Calidad legal + PWA + cobros 🔄

### Validación legal con abogado *(prio 1)*
- [x] Texto del contrato extraído para revisión (`web/docs/contrato-vivienda-urbana-revision-legal.txt`).
- [x] Análisis comparativo con modelo del abogado (`web/docs/legal-abogado/analisis-comparativo.md`).
- [x] Plan de mejoras contrato + flujo (`web/docs/plan-mejoras-contrato-flujo.md`).
- [ ] Confirmaciones pendientes del abogado (sección 6 del plan).
- [ ] Aplicar cambios → nueva versión `AS-LEASE-2026.2`.
- [ ] Definir y precificar **cláusulas particulares** como servicio adicional.
- [ ] Insertar bloque `[CLAUSULAS_ESPECIALES_CONDICIONAL]` (entre DÉCIMA NOVENA y VIGÉSIMA).

### Mejoras de contrato + flujo (`AS-LEASE-2026.2`) — *(prio 1, ejecución por bloques)*
Ver detalle en `web/docs/plan-mejoras-contrato-flujo.md`.

- [x] Bloque 1 — Tipos y borrador del nuevo contrato (`AS-LEASE-2026.2`, sin activar).
- [x] Bloque 2 — Consentimiento de datos en registro y en inicio del wizard.
- [x] Bloque 3 — Anotaciones especiales del expediente (visibles en UI, no imprimibles).
- [x] Bloque 4 — Selector de tipo de contrato (urbano activo; otros “próximamente”).
- [x] Bloque 5 — Cláusulas especiales (mascotas, etc.) + aviso de costo adicional.
- [x] Bloque 6 — Estudio de crédito (link/aliado o “próximamente”).
- [x] Bloque 7 — Firma reforzada: OTP por correo, verificación, evidencia ampliada, anexo HTML (Ley 527), **constancia PDF** del anexo de evidencia al completar firma, **`audit_logs` en Firestore** vía `auditEvent` (incluye OTP).
- [x] Bloque 8 — Anexo de evidencia: hub `/dashboard/contracts/[id]/evidencia`, ZIP `GET /api/contracts/evidence-bundle` con límites de tamaño, **PDF del anexo de pagos**, descarga autenticada `GET /api/contracts/annexes/pdf`, persistencia en Storage o disco.
- [x] Bloque 9 — Autenticación notarial opcional (descarga + carga de PDF autenticado).
- [x] Bloque 10 — Módulo de novedades y solicitudes con notificación por email y trazabilidad.
- [x] Bloque 11 — Activación operativa de `AS-LEASE-2026.2` vía `NEXT_PUBLIC_LEASE_TEMPLATE_2026_2_ENABLED` + render en preview; expedientes antiguos conservan su versión guardada.
- [~] Bloque 12 — Soportes codeudor: listo `POST /api/codebtor-supports/upload-url` (firma v4, solo arrendador). Falta confirm, download, UI, `storage.rules`, ZIP evidencia.
- [~] Bloque 13 — Aviso de privacidad: resumen de encargados + canal en `/legal/aviso-privacidad`; **eliminación de cuenta ya operativa** (`/api/cuenta/eliminar` + `/dashboard/cuenta/eliminar`). Falta `AVISO-PRIV-2026.2` completo (encargados, transferencia internacional).

### PWA instalable *(prio 2)*
- [x] `web/public/manifest.webmanifest` (`display: standalone`, theme/background `#0b0f1a`, íconos desde PNG existente).
- [x] Service worker (`/sw.js`, estáticos con huella; sin cache-first en HTML de navegación) + registro en layout.
- [x] CTA instalar en landing (`LandingInstallApp`) + banner global en layout (`PwaInstallSiteBanner`, oculto en `/`).
- [ ] Íconos morados AS dedicados 192/512 + maskable (sustituir placeholder cuando existan assets finales).
- [ ] Splash y meta-tags iOS/Android dedicados.
- [ ] Probar instalación real en Android (Chrome) y iOS (Safari → Compartir).

### Cobros reales *(prio 3)*
- [~] Plan **Plus** y entitlements en Firestore (`access_entitlements`).
- [~] Pasarela de pagos (Wompi) — en integración (ver `web/docs/payments-wompi.md`).
- [ ] Webhook validado en producción + reconciliación.
- [ ] Mensajes claros de bloqueo cuando no hay plan vigente.

### Email transaccional *(prio 4)*
- [x] Servicio centralizado (`web/src/services/email/`) con Resend + mock.
- [x] Plantillas y `email_logs`.
- [ ] Activar envío real con dominio verificado y revisar deliverability.

---

## Fase 3 — Confianza (reputación y calificaciones) ⏳

- [~] Evaluación estructurada en código (`dashboard/contracts/[id]/review` + cláusula DÉCIMA CUARTA).
- [ ] Flujo público para calificar tras cierre o hito definido.
- [ ] Visualización agregada en perfil (sin lista negra ni consulta libre por cédula).
- [ ] Reglas para anti-fraude / disputas básicas.
- [ ] Política de retención y portabilidad de evaluaciones.

> Restricción de fase: no exponer calificaciones públicas mientras esté en **Fase 2**.

---

## Fase 4 — Crecimiento (marketplace ligero) ⏳

- [ ] Publicación opcional del inmueble (solo cuando confianza esté validada).
- [ ] Búsqueda y filtros básicos por ciudad/canon.
- [ ] Mensajería entre partes con bitácora.
- [ ] Reglas claras de moderación y reporte.

---

## Capa transversal — Calidad y operación

### Seguridad y datos
- [x] Validación Zod en API públicas (`/api/leads`, etc.).
- [x] Admin SDK aislado en server.
- [x] **Reglas Firestore/Storage versionadas** (`web/firestore.rules`, `web/storage.rules`, `web/firebase.json`) en modelo *deny-all* al cliente: el navegador no usa `firebase/firestore` ni `firebase/storage`; todo pasa por Admin SDK. **Pendiente desplegarlas** (`firebase deploy --only firestore:rules,storage:rules`) y confirmar en consola.
- [x] **Rate-limit** en endpoints públicos (`/api/leads`, `/api/contact`, `/api/signatures/request-otp`) vía `src/lib/security/rate-limit.ts` (Upstash + fallback en memoria). Falta cargar `UPSTASH_REDIS_REST_*` en Vercel.
- [x] **Cabeceras de seguridad + CSP** de producción en `web/next.config.ts`.
- [x] Mapas de error de Firebase a textos en español (`firebase-errors.ts`).

### Mobile-first y accesibilidad
- [x] Convenciones documentadas en `arriendoseguro-mobile-pwa.mdc`.
- [~] Aplicar checklist mobile-first a pantallas existentes (encuesta lista, faltan formularios del wizard).
- [ ] Auditoría AA de contraste y foco visible.
- [x] Tema visual claro forzado (`globals.css` → `color-scheme: light`, fondo `slate-50`, botones violet-600 con `text-white`).
- [x] Tono colombiano en toda la copia visible al usuario (sin voseo argentino/chileno; se usan formas como “tienes”, “puedes”, “necesitas”).

### Observabilidad
- [x] Auditoría persistente (`audit_logs`) en eventos críticos.
- [ ] Panel de errores (Sentry o equivalente) — opcional, evaluar costo/beneficio.

### KPIs (revisar mensual)
- [ ] Funnel landing → encuesta → registro → primer contrato firmado.
- [ ] % de contratos completados sin abandono en wizard.
- [ ] Tiempo medio para generar el primer contrato.
- [ ] NPS post-firma vía evaluación estructurada.
- [ ] Tasa de errores de firma o PDF.

---

## Política de avance

1. No abrir Fase 3 hasta cerrar **prio 1, 2 y 3** de Fase 2.
2. Cualquier feature que no encaje en este tablero va al backlog, no se cuela en el flujo.
3. Cambios mayores: planificar antes de implementar (regla `arriendoseguro-quality-launch.mdc`).
