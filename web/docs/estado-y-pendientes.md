# Estado del proyecto y pendientes (para retomar)

> Cierre de auditoría 2026-06-05. **Build ✓ · 152/152 tests ✓ · nada roto.**
> La app está **funcionalmente completa** (todo el plan 1–11 + epic QR + modelo
> de monetización). Lo que sigue son **endurecimientos y conexiones de
> proveedores** antes de un lanzamiento público en serio.

## 1. Estado funcional — COMPLETO

Auditoría de funcionalidad: **no hay rutas ni flujos rotos.** Verificados end-to-end (en código):
- Wizard Bloque 1 (9 pasos) → guardar versión → PDF → firma. ✓
- Codeudores múltiples (datos, plantilla, firma `solidaryCoDebtor_2..`). ✓
- Centro de adicionales, documentos de propiedad/poder, método de pago. ✓
- Enlace mágico del inquilino (`/pago/[token]` → info/sign/submit) → confirmación del dueño 1-clic → escalamiento. ✓
- Referido calificado + desbloqueo de firma; SMS solo-pago. ✓

Único arreglo cosmético hecho hoy: se quitó un botón muerto "Continuar a firma (Próximamente)" en `preview`.

## 2. Seguridad — ENDURECER ANTES DE LANZAMIENTO PÚBLICO (prioridad ALTA)

Hallazgos reales (la app usa Admin SDK + reglas deny-all, pero hay endpoints de servidor sin sesión):

| # | Hallazgo | Archivo | Remediación |
|---|---|---|---|
| ✅ S1 | **GET sin auth que exponen datos por id** | `api/payments/list`, `api/contracts/latest-version`, `api/contracts/pdf/[contractVersionId]`, `api/inventory/detail` | **HECHO.** `payments/list` + `pdf/[id]` + `inventory/detail` exigen `requireContractParticipant`; clientes envían `buildAuthHeaders`. `latest-version` se recortó para no exponer PII (solo `status`/`currentVersionId`/`lease` básico). El PDF se descarga por `<ContractPdfDownloadLink>` (fetch autenticado + blob) y se sirve por stream desde Storage (sin redirect a URL firmada, para no romper CORS). |
| ✅ S2 | **POST sin auth (`TODO(auth)` reales)** | `api/contracts/save-draft-version`, `api/contracts/preview` | **HECHO.** Ambos exigen `requireAuthenticatedUser`; en `save-draft-version` se registra `createdByUid` en CREATE y se valida propietario en UPDATE. Clientes envían el token. |
| ✅ S3 | **Endpoints públicos tokenizados sin rate-limit** | `api/payments/upload/{info,sign,submit}`, `api/partners/lead/confirm`, `api/payments/confirm` | **HECHO.** `checkRateLimit(clientIp, RATE_LIMIT_RULES.publicToken)` (30/min) en los 5; 429 con `Retry-After`. |
| ✅ S4 | **Validación de ruta de Storage por prefijo, no exacta** | `api/payments/upload/submit` | **HECHO.** El remanente tras el prefijo esperado se valida como segmento único (sin `/` ni `..`), evitando movimiento lateral. |
| ✅ S5 | **Validación de archivos solo por metadatos** | `domain/payments/supportValidation`, subidas | **HECHO.** `sniffSupportFileKind`/`isAllowedSupportMagic` (PDF/JPG/PNG/WEBP) + test; en `payments/upload/submit` se descarga la cabecera real del objeto y, si no coincide, se borra y se rechaza (422). |
| ✅ S6 | TODO(auth) obsoletos (ya autentican) | `api/contracts/generate-pdf`, `api/signatures/start` | **HECHO.** Comentarios limpiados; la auth real ya existía (`requireContractParticipant`). |

**Bien:** reglas Firestore/Storage deny-all ✓; admin por `ADMIN_INTERNAL_EMAILS` server-side ✓; tokens aleatorios ✓; número de cuenta enmascarado en paneles (al inquilino se muestra completo **a propósito y con consentimiento** del dueño) ✓.

## 3. Escalabilidad — OPTIMIZAR ANTES DE VOLUMEN ALTO (prioridad MEDIA)

| # | Hallazgo | Archivo | Remediación |
|---|---|---|---|
| ✅ E1 | **Crons escanean la colección completa** (sin filtro de estado ni `limit`) | `api/payments/reminders/send-due`, `api/payments/tenant-reminders/send-due`, `api/contracts/renewal-reminders/send-due` | **HECHO.** Recordatorios de pago: rango sobre `dueDate` (único campo, auto-indexado, sin índice compuesto) acotado a la ventana de hitos + `limit`. Renovación: `limit(5000)` + se omite la lectura de versión cuando ambos recordatorios ya se enviaron. Escalamiento ya filtraba por igualdad; se añadió `limit`. *Nota:* para volumen muy alto, denormalizar `leaseEndDate` en el doc del contrato permitiría rango también en renovación. |
| ✅ E2 | **Endpoints admin sin paginación** | `api/admin/{referrals,partner-leads,reputation-flags,partners}` | **HECHO.** `partner-leads` ya tenía `orderBy+limit(200)`. Se añadió `limit(1000)` a `referrals`, `reputation-flags` y `partners`, con bandera `truncated` en la respuesta para avisar si hay más (sin tope silencioso). Cursor por página queda como mejora futura si crece. |
| ✅ E3 | **PDF generado en el request** (bloqueante) | `api/contracts/generate-pdf`, `payments/generate-annex`, `delivery-act/generate` | **HECHO (evaluado).** El render usa **pdf-lib (JS puro, sin navegador headless)** → milisegundos; el riesgo de timeout es bajo. Se añadió `maxDuration = 60` (headroom) en los 3 y medición `renderMs`/`pdfBytes` en el audit de `generate-pdf` para observar p95 real. Mover a job en background **no es necesario** con esta arquitectura; revisar solo si se cambia a render pesado (Puppeteer/imágenes). |

*Nota:* los índices de campo simple (incluido anidado como `contractPayload.landlord.email`) los **auto-indexa Firestore**; no es un bug. Solo harían falta índices **compuestos** si se agregan consultas con `where`+`orderBy` sobre campos distintos.

## 4. Legal — REVISAR CON ABOGADO ANTES DE PUBLICITAR (prioridad según lanzamiento)

| # | Tema | Estado |
|---|---|---|
| L1 | Ley 820 (tope 1%, garantía Art.15, prohibición depósito, IPC, mora) | **CUMPLE** (motor `rent-law`/`legalCompliance` correcto). |
| L2 | Firma electrónica Ley 527 (token+OTP+IP+UA+hash+consentimientos) | **CUMPLE**; reforzar redacción de la cláusula "firma simple vs certificada". |
| L3 | Habeas Data — consulta de reputación con consentimiento | Evidencia (IP/UA/fecha) **SÍ se captura** en `lookup/respond`. Igual **revisar con abogado** el flujo completo (ya anotado). Solo agregados, sin detalle, con derecho de réplica ✓. |
| L4 | **Identificación del responsable del tratamiento** (NIT/razón social) | **GAP — acción del fundador:** publicar en `aviso-privacidad` antes de producción. |
| L5 | Consentimiento de codeudores adicionales | El 1er codeudor tiene consentimientos explícitos; los adicionales tienen casilla de tratamiento+firma. Verificar suficiencia con abogado. |
| L6 | Disclaimers menores (calculadora garantía; datos de terceros/menores en cargas) | Agregar avisos breves. |

## 5. Conexión de proveedores — PRÓXIMAS SESIONES (dependencias externas)

| Proveedor | Para qué | Estado / qué falta |
|---|---|---|
| **Wompi** (pagos) | Cobrar Plan Plus y el **micropago $10k** | Aparcado. Conectar hub de pagos + llaves. Habilita el cobro real. |
| **Firma.dev / proveedor CO** (firma certificada) | Escalón premium de firma | Andamiaje listo (`signatures/provider`). Falta: confirmar validez CO de Firma.dev (declara US/EU) o elegir proveedor colombiano (Nucli ~$1.300–1.600/firma); entregar llaves; implementar el adaptador + webhook. |
| **AdSense** | Ads en el tier gratis (cubre infra) | Falta aprobación de Google + slots de anuncio + contenido real (en marcha). |
| **Twilio (SMS)** | SMS real (solo planes de pago) | Variables `TWILIO_*` en Vercel; hoy en modo mock. |

## 6. Acciones manuales del fundador

Ver `acciones-manuales-fundador.md` (resumen): programar **crons** (recordatorios al inquilino, IPC, alertas de errores, renovación, pagos), desplegar **reglas Firebase**, definir **env vars** en Vercel, Search Console, y los proveedores de §5.

## 7. Análisis de rentabilidad

Ver `analisis-rentabilidad-planes.md` (con datos reales de Firma.dev/Wompi/Nucli): todos los planes son rentables (46–88%); el micropago $10k es seguro; la firma certificada es barata; el único matiz es legal (validez CO de Firma.dev).

---

**Conclusión:** la app está **funcional y sin nada roto**, lista para pruebas. Para un lanzamiento público en serio quedan, en orden: (1) endurecer seguridad §2, (2) revisión legal §4 + datos del responsable, (3) conectar proveedores §5, (4) optimizar escalabilidad §3 cuando crezca el volumen.
