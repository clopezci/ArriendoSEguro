# Módulo de indicadores (Lean Startup) — diseño reusable

Guía para montar un **tablero de indicadores** que mida el desempeño de una app
desde la óptica de *Lean Startup*, con métricas accionables (no "de vanidad").
Está escrito para reutilizarse en **otras aplicaciones** (TiendaFácil, Criterio
Nacional, TransformaDigital, etc.): la primera parte es teoría + modelo mental;
la segunda es la arquitectura técnica portable; la tercera, el checklist de
implementación por app.

> En ArriendoSeguro este módulo vive en `/admin` (pestaña **Lean**), se alimenta
> de Firestore + Google Analytics 4 (GA4 Data API) + un **contador de visitas
> propio sin cookies** (independiente del consentimiento) y se resume cada día por
> Telegram. Ver también `docs/GA4-VISITAS-TELEGRAM.md`.
>
> **Última actualización (2026-08-29):** se añadió el contador de visitas propio
> sin cookies (§4.3), se reforzó la fiabilidad de la medición de **ingresos**
> (reconciliación de pagos, §Ingresos/§8) y el modelo financiero para
> inversionistas incorpora **% RRHH**, **comisión de pasarela**, **impuesto de
> renta** y **reparto con el inversionista** (Bloque 2, §9–§10.1).

---

## 1. Premisas de Lean Startup (lo que no puede faltar)

Eric Ries (*The Lean Startup*) propone medir el progreso de un producto por
**aprendizaje validado**, no por líneas de código ni por vanidad. Tres columnas:

### 1.1 Contabilidad de la innovación (*innovation accounting*)
No basta con "los números suben". Hay que probar que el **motor mejora**. Se hace
en 3 pasos:
1. **Establecer la línea base** con un MVP: medir hoy las tasas reales del embudo
   (aunque sean malas).
2. **Afinar el motor**: cada cambio busca mover UNA tasa del embudo (p. ej.
   activación) de la base hacia el ideal.
3. **Pivotar o perseverar**: si tras varias iteraciones las tasas no se acercan al
   ideal, se pivota.

La herramienta central es el **análisis por cohortes**: en vez de acumulados,
se mira "de los que entraron esta semana, ¿qué % activó / pagó?" y se compara
semana a semana. Si la cohorte nueva convierte mejor que la vieja, el motor mejora.

### 1.2 Métricas accionables vs. de vanidad
- **De vanidad**: totales acumulados que solo suben (usuarios totales, page views
  totales). Se ven bien pero no guían decisiones.
- **Accionables**: cumplen las **"3 A"**:
  - **Accionable** (*actionable*): ligada a una causa → una acción. "La activación
    cayó cuando cambiamos el paso 3".
  - **Accesible** (*accessible*): entendible por todo el equipo, en lenguaje simple.
  - **Auditable** (*auditable*): se puede rastrear al dato/persona real (no un número
    mágico de un dashboard).

### 1.3 Motores de crecimiento (*engines of growth*)
Un producto crece por **uno** de estos motores (elige el dominante y optimízalo):
- **Pegajoso (*sticky*)**: crece si **retiene**. Métrica: tasa de retención vs.
  **tasa de abandono (churn)**. Crece si `activación > churn`.
- **Viral**: crece porque los usuarios **traen** a otros. Métrica: **coeficiente
  viral `k`** = (invitaciones enviadas por usuario) × (tasa de conversión de los
  invitados). Si `k > 1`, crecimiento viral autosostenido.
- **Pagado (*paid*)**: crece si **`LTV > CAC`** (valor de vida del cliente mayor
  que el costo de adquirirlo). El margen (`LTV − CAC`) se reinvierte en adquirir.

---

## 2. Marco práctico: métricas "pirata" AARRR

David McClure resume el embudo en 5 etapas ("AARRR"), compatibles con Lean y
fáciles de instrumentar. Para cada app se define **el evento que marca cada
etapa** y se mide la **conversión entre etapas** (eso es lo accionable).

| Etapa | Pregunta | Ejemplo genérico | En ArriendoSeguro |
|---|---|---|---|
| **Adquisición** | ¿Llegan? | visitas, registros | Visitas GA4 → registros (Auth) |
| **Activación** | ¿Viven su 1ª buena experiencia? | completó onboarding | creó su 1er contrato / lo generó |
| **Retención** | ¿Vuelven? | usuarios recurrentes | 2º+ contrato, uso de posventa |
| **Ingresos** | ¿Pagan? | compras, $ | pago del Plan Plus ($) |
| **Referidos** | ¿Traen a otros? | invitaciones que convierten | referidos + invitación a la contraparte |

**North Star Metric (NSM):** una sola métrica que captura el valor entregado.
Debe ser un número que, al subir, signifique que el producto le sirve a la gente
(no solo que factura). En ArriendoSeguro proponemos:
> **NSM = arriendos activos gestionados** (contratos firmados y vigentes en la
> plataforma). Combina activación + ingreso + retención en un solo número.

---

## 3. Catálogo de indicadores propuesto

Marcados: **[base]** = con datos que ya existen; **[evt]** = requiere instrumentar
eventos; **[cfg]** = requiere un dato de configuración (p. ej. costo de marketing).

### Adquisición
- **[base]** Visitas por día (usuarios GA4) + serie 14/30 días. *(Depende del
  consentimiento de cookies; ver §4.1.)*
- **[base]** **Visitas propias SIN cookies** (contador interno): visitantes únicos
  y vistas por día, **independientes del consentimiento**. En el panel:
  "Propias 7d (sin cookies)" y "Propias hoy". Ver §4.3.
- **[base]** De dónde llegan (canal GA4: directo, orgánico, redes, referral).
- **[base]** Registros (Auth) y su tendencia semanal.
- **[cfg]** **CAC** = gasto de marketing del periodo ÷ nuevos clientes pagos.

### Activación
- **[base]** Contratos creados / generados (con versión) por periodo.
- **[base]** **Tasa de activación** = registros que crean su 1er contrato.
- **[evt]** **Abandono por paso del asistente** (`/nuevo`): en qué pregunta se caen.
- **[evt]** Tiempo medio hasta activar (registro → 1er contrato).

### Retención
- **[base]** **Usuarios recurrentes** (2º+ contrato) y % sobre el total.
- **[base]** Uso de posventa (pagos registrados, novedades, calificaciones).
- **[base]** **Churn** aproximado = 1 − retención de la cohorte.

### Ingresos
- **[base]** **Ingresos $** (suma de pagos **aprobados**) total / 30 días / hoy.
- **[base]** **Ticket promedio** = ingresos ÷ nº de pagos.
- **[base]** **ARPU** = ingresos ÷ usuarios activos.
- **[base]** Conversión **contrato → pago**.
- **[cfg]** **LTV** ≈ ticket × nº medio de contratos por cliente (× margen).

> **Fiabilidad de la medición de ingresos (importante):** el ingreso solo cuenta
> pagos **APROBADOS**, no órdenes. Una orden puede quedar en `pending` si la
> pasarela confirmó el pago pero el **webhook** no llegó o el usuario no volvió a
> la página de retorno. Para que **ningún pago se pierda** ni se subcuente, hay
> **tres capas de conciliación**: (1) **webhook** de la pasarela; (2)
> **reconciliación en la página de retorno** (consulta directa a la pasarela con el
> id de transacción); (3) **barrido diario** (cron) que revisa las órdenes
> `pending` y las concilia contra la pasarela por su referencia (idempotente), más
> un botón manual en `/admin`. Así el indicador de ingresos refleja el dinero real
> aunque falle una vía. En ArriendoSeguro: colección `platform_orders` (espejo) vs.
> `platform_payments` (dinero real); `lib/observability`/`domain/platform-payments`.

### Referidos (motor viral)
- **[base]** Invitaciones a la contraparte enviadas / aceptadas.
- **[base]** Referidos registrados / calificados (programa "3 referidos").
- **[base]** **Coeficiente viral `k`** ≈ invitaciones por usuario × tasa de aceptación.

### Contabilidad de la innovación (cohortes)
- **[evt/base]** **Embudo por cohorte semanal**: de los que entraron la semana N,
  ¿qué % activó / firmó / pagó? Comparado contra semanas previas.
- Semáforo: 🟢 mejora vs. cohorte previa · 🟡 igual · 🔴 empeora.

---

## 4. Arquitectura técnica (portable entre apps)

Dos fuentes complementarias:

### 4.1 Tráfico anónimo → **Google Analytics 4 (Data API)**
- El front ya manda `page_view` por gtag (`NEXT_PUBLIC_GA_MEASUREMENT_ID`).
- El backend lee agregados con la **GA4 Data API** (`analyticsdata.googleapis.com`),
  autenticando con la **cuenta de servicio** del proyecto (rol *Lector* en la
  propiedad GA4). Es **gratis**. Ver `lib/observability/ga4.ts` como referencia
  (`ga4Access()` + `ga4RunReport()` genéricos, reutilizables).
- Da: usuarios/sesiones/vistas por día, canal, dispositivo, país/ciudad, páginas.
- **Ojo (importante):** GA4 se rige por el **consentimiento de cookies**
  (**Consent Mode v2**, con analítica **denegada por defecto**, privacy-first). Si
  el visitante **no acepta** el banner, GA4 **no lo cuenta** en los informes → en
  fases tempranas "Visitas 7d (GA4)" puede salir en **0** aunque sí haya tráfico
  (súmale el retraso de procesamiento de 24–48 h). Por eso se complementa con el
  **contador propio sin cookies** (§4.3), que no depende del consentimiento.

### 4.2 Embudo propio y dinero → **Firestore**
Dos estrategias, se pueden combinar:

**A. Derivado (rápido, sin instrumentar).** Contar sobre colecciones que ya
existen: registros (Auth), `contracts`, `signatures`, `platform_orders` (llegó
al checkout), `platform_payments` (pagó), `lead_forms` (encuesta),
`access_entitlements` (compras activas), `party_invites`, `referral_*`. Con esto
se arma el embudo AARRR y los ingresos SIN tocar el producto. **Empieza por aquí.**

**B. Event log (granular).** Una colección **`analytics_events`** con un esquema
mínimo:
```
analytics_events/{autoId} = {
  name: string,        // "contract_started" | "reached_payment" | "paid" | ...
  at: string(ISO),     // + serverTimestamp
  day: "YYYY-MM-DD",   // bucket para cohortes
  uid?: string,        // si hay sesión
  anonId?: string,     // cookie/localStorage para anónimos
  props?: object       // { step, plan, amountCop, source, ... }
}
```
Con un helper server `logEvent()` (fail-safe, nunca lanza) y un endpoint
`POST /api/analytics/event` para eventos del cliente (best-effort, sin bloquear
UX). Se instrumentan SOLO los hitos que no se pueden derivar: pasos del asistente
(drop-off), "llegó a pagar", etc. **Regla de oro:** nombres de evento estables y
en `snake_case`; nunca meter PII en `props`.

### 4.3 Contador de visitas propio (SIN cookies) → Firestore

Medición de tráfico **anónima, sin cookies y sin consentimiento** (estilo
Plausible/Fathom), que da un número real aunque GA4 salga en 0 por el banner.
**No guarda datos personales.**

- **Beacon del cliente** `components/analytics/pageview-beacon.tsx`, montado en el
  `layout`. En cada cambio de ruta manda `navigator.sendBeacon` (respaldo `fetch`
  con `keepalive`) a `POST /api/metrics/pageview` con solo la ruta. No usa cookies
  ni identificadores persistentes.
- **Servidor** `lib/observability/pageviews.ts` (Admin SDK): agrega en un doc por
  día `analytics_pageviews/{YYYY-MM-DD}` = `{ date, views, visitors }`. Para no
  contar dos veces al mismo visitante **en el mismo día**, crea un subdoc con un
  **hash salado y rotado por día** de `(ip + user-agent + fecha)` (SHA-256, sin
  guardar la IP). Como el hash **incluye la fecha**, no es enlazable entre días →
  **no permite rastrear a una persona** en el tiempo. Filtra bots comunes y rutas
  internas (`/api`, `/_next`, `/admin`, assets).
- **Privacidad/legal:** al no almacenar datos personales ni usar cookies, **no
  requiere consentimiento**. Documentado en el aviso de privacidad y la política de
  cookies del sitio.
- **Limpieza:** una tarea diaria del cron (`/api/metrics/pageview/purge/send-due`)
  borra los subdocs de hash de días pasados (solo sirven para deduplicar su propio
  día); los agregados por día se conservan. Env opcional `ANALYTICS_SALT`.
- **En el panel:** el `GET /api/admin/dashboard` expone `acquisition.ownVisitors7d`
  / `ownViews7d` / `ownVisitorsToday`; la tarjeta Adquisición muestra "Propias 7d
  (sin cookies)" y "Propias hoy" junto al dato de GA4.

> **Reutilización:** el trío GA4 (`ga4.ts`, consent-gated) + **contador propio sin
> cookies** (`pageviews.ts` + `PageviewBeacon` + `/api/metrics/pageview`) +
> `analytics_events` + el cálculo AARRR es idéntico en cualquier app Next.js +
> Firebase. Cambian solo (1) qué colecciones se derivan y (2) qué eventos se
> instrumentan. Copia `lib/observability/{ga4,pageviews}.ts`, el beacon,
> `lib/analytics/*` y la sección Lean del panel; ajusta el mapa de etapas.

---

## 5. Tableros visuales (fáciles de entender)

Principio: **cada número dice una acción**. Nada de tablas frías sin contexto.

1. **Tarjetas AARRR** (5 columnas de colores): un número grande por etapa + la
   **conversión** a la siguiente etapa debajo. Verde/rojo según mejore o empeore.
2. **Barras por día** (visitas / registros): ya implementadas en `/admin`.
3. **Bar chart race animado**: barras que compiten y se reordenan **cuadro por
   cuadro** (semana a semana), mostrando cómo crecen Registros vs. Contratos vs.
   Firmas vs. Compras en el tiempo. Autocontenido con `requestAnimationFrame`
   (sin librerías externas; compatible con CSP de Artifacts). Ideal para contar la
   historia del crecimiento de un vistazo.
4. **Semáforo de cohortes**: tabla compacta semana × etapa con 🟢🟡🔴.
5. **Medidores simples**: ARPU, ticket, `k` viral, churn — con una frase que
   explique "qué es bueno" (p. ej. "k>1 = crecimiento viral").

---

## 6. Checklist para montar el módulo en una app nueva

1. **GA4**: crear propiedad, poner `NEXT_PUBLIC_GA_MEASUREMENT_ID`, montar
   `GoogleAnalytics` en el layout. Para leer por API: `GA4_PROPERTY_ID` +
   cuenta de servicio como *Lector* (ver `docs/GA4-VISITAS-TELEGRAM.md`).
2. **Copiar** `lib/observability/ga4.ts` (helpers genéricos) y la sección Lean del
   panel `/admin`.
3. **Definir el mapa de etapas AARRR** de esa app (qué colección/evento marca cada
   etapa) y el **North Star**.
4. **Ingresos**: identificar la colección de pagos y la unidad del monto
   (¡ojo cents vs. pesos!). En ArriendoSeguro `platform_payments.amount` está en
   **COP enteros** (el webhook divide `amount_in_cents/100`).
5. **Derivar primero** (estrategia A) para tener tablero ya. **Instrumentar
   después** (`analytics_events`, estrategia B) los hitos que falten (drop-off).
6. **Cohortes**: agregar el bucket `day`/`week` y el semáforo de comparación.
7. **Resumen diario** por el canal que uses (Telegram/correo) reutilizando el
   texto del panel.

---

## 6b. Captura de MOTIVOS DE ABANDONO (micro-encuesta de salida)

Patrón "pro" y **no intrusivo** para saber *por qué* se va la gente sin actuar:

- **Componente global** `components/analytics/exit-intent-survey.tsx`, montado en el
  `layout`. Se **arma solo en rutas del embudo** (`/`, `/nuevo`).
- **Disparadores** (solo con la página **visible**, para no aparecer "cuando el
  usuario vuelve de otra app"): en escritorio, el cursor sale por el borde
  superior; en **móvil y escritorio**, el **botón «Atrás»** (trampa con
  `history.pushState` + `popstate`) muestra la encuesta al instante en vez de
  dejarlo salir en silencio. Nunca antes de ~6 s; no interrumpe si escribe.
- **Anti-cansancio**: máximo **una vez por sesión** y, si la ve, **no vuelve en
  14 días** (`localStorage`). Cierre fácil con la "×".
- **Una sola pregunta** con chips de motivo (solo mirando / me equivoqué / no es
  lo que buscaba / complicado / precio / falta info / otro→texto). Un toque →
  evento `abandon_reason` con `props.reason`. Cerrar → `abandon_dismissed`.
- **Conteo SIEMPRE (aunque no den motivo)**: al ocultarse la página
  (`visibilitychange`/`pagehide`) se registra `page_abandon`. En el panel:
  `sin motivo = page_abandon − abandon_reason`.
- **Retorno** (¿esos casos vuelven?): al volver a estar visible tras irse se
  registra `app_return` (privado, por `anonId`; **sin GPS**). En el panel/Telegram:
  "regresaron N/total".

Se ve en `/admin` → Lean → "🚪 Por qué se van" (ranking de motivos) y
"🧭 Dónde se caen en el asistente" (drop-off por paso, con personas únicas).

> Reusable: copia el componente + `lib/analytics/{track,events}.ts` +
> `/api/analytics/event`. Ajusta `ARMED_ROUTES`, los motivos y el cooldown.

## 6c. Encuesta de BAJA (churn) de un solo paso

Al **eliminar la cuenta** (`/dashboard/cuenta/eliminar`) se muestra una encuesta
**de un paso, opcional y anónima**: chips de motivo (ya no lo necesito / no le di
uso / muy costoso / faltan funciones / problema / encontré otra opción / privacidad
/ otro→texto). Registra `account_cancel_reason`. Un botón "Enviar motivo" permite
dejar la razón aunque la baja automática esté bloqueada (p. ej. con contratos
firmados). Se ve en `/admin` → Lean → "👋 Por qué se dan de baja".

---

## 8. Auditoría de fuentes de datos (¿cada indicador se alimenta solo?)

> **Freshness:** el panel **recalcula en vivo en cada carga** (`GET
> /api/admin/dashboard` consulta Firestore + GA4 al momento). No hay cachés que
> envejezcan: cuando entras, todo está al día. Lo único que varía es si un
> indicador **tiene fuente** o no.

Leyenda: ✅ automático · ⚠️ automático pero aproximado · ❌ falta fuente.

| Indicador | Fuente | Estado |
|---|---|---|
| Usuarios registrados | Firebase Auth (`listUsers`) | ✅ |
| Encuestas | `lead_forms` | ✅ |
| Accesos demo / Plus activos | `access_entitlements` | ✅ |
| Contratos creados / versiones / firmados | `contracts`, `contract_versions` | ✅ |
| Pagos aprobados / Ingresos $ / ticket | `platform_payments` (APPROVED, COP) | ✅ |
| ARPU | ingresos ÷ registrados | ✅ |
| Visitas / canal / dispositivo / páginas | GA4 Data API | ✅ (requiere `GA4_PROPERTY_ID`; sujeto a consentimiento de cookies) |
| **Visitas propias (sin cookies)** | `analytics_pageviews` (beacon propio) | ✅ (independiente del consentimiento) |
| Ingresos $ **conciliados** (webhook + retorno + barrido) | `platform_payments` APPROVED | ✅ (3 capas anti-pérdida) |
| Embudo encuesta→registro→contrato→firma | derivado | ✅ |
| North Star (arriendos activos) | `contracts` firmados | ✅ |
| Abandono + motivos | `analytics_events` (`page_abandon`, `abandon_reason`) | ✅ |
| Abandono **sin motivo** + **retorno** | `page_abandon` − `abandon_reason`; `app_return` (por `anonId`) | ✅ |
| Drop-off del asistente | `analytics_events` (`nuevo_step`) | ✅ |
| Checkout alcanzado → pago | `analytics_events` (`reached_payment`) + pagos | ✅ |
| Motivos de baja | `analytics_events` (`account_cancel_reason`) | ✅ |
| Recurrentes / retención | agrupado por usuario en `access_entitlements` | ⚠️ aprox |
| Coeficiente viral `k` | invitaciones ÷ usuarios (`party_invites`) | ⚠️ aprox (falta tasa de aceptación) |
| Referidos calificados | `referral_codes` / eventos `referral_*` | ⚠️ sin desglose |
| LTV | ticket × contratos por cliente | ❌ no calculado aún |
| **CAC** | gasto de marketing ÷ nuevos pagos | ❌ no hay fuente del gasto |
| Tiempo hasta convertir | registro → 1er pago | ❌ no calculado aún |
| Semáforo de cohortes | conversión por semana de alta | ❌ no construido |

## 9. Plan para que TODO se alimente solo — ✅ IMPLEMENTADO

Todo lo de abajo quedó construido (prod, 2026-08-24) y se auto-actualiza en cada
carga del panel. Único dato manual: el gasto de marketing (1 vez al mes).

- ✅ **LTV automático**: ticket × contratos por cliente pagador.
- ✅ **Coeficiente viral `k` real**: invitaciones/usuario × tasa de aceptación
  (`party_invites.completedAt`); referidos calificados = Σ `referral_codes.qualifiedCount`.
- ✅ **Tiempo hasta convertir**: primer pago − alta (promedio y mediana).
- ✅ **Semáforo de cohortes** 🟢🟡🔴: altas por semana + su activación/pago, y
  comparación con la cohorte previa (contabilidad de la innovación).
- ✅ **CAC + LTV/CAC**: mini-form de gasto de marketing en /admin → Lean
  (`/api/admin/marketing-config`, doc `admin_config/marketing`); CAC = gasto ÷
  pagos de 30 días; se muestra la relación LTV/CAC (sano ≥ 3×).

Detalle original del plan (referencia):

1. **LTV automático (⚠️→✅)**: `LTV ≈ ticket × (contratos por cliente pagador)`.
   Datos ya disponibles (`platform_payments` + `access_entitlements`). Solo es
   cálculo en el endpoint. *Esfuerzo: bajo.*
2. **Coeficiente viral `k` real (⚠️→✅)**: `k = invitaciones/usuario ×
   aceptación`. Contar `party_invites` aceptadas (campo de estado) y/o eventos
   `referral_qualified` ÷ `referral_registered`. *Esfuerzo: bajo-medio.*
3. **Tiempo hasta convertir (❌→✅)**: por cada usuario pagador, `fecha 1er pago −
   fecha de alta` (Auth). Promedio + mediana. *Esfuerzo: bajo.*
4. **Semáforo de cohortes (❌→✅)**: agrupar altas por semana y medir su
   conversión posterior (activó / firmó / pagó); comparar cohorte N vs N-1 →
   🟢🟡🔴. Datos: Auth + `contracts` + `platform_payments` por usuario. Con esto
   se cierra la **contabilidad de la innovación**. *Esfuerzo: medio.*
5. **CAC (❌→✅ con 1 dato/mes)**: única pieza que necesita un dato externo. Añadir
   un mini-formulario en `/admin` que guarde el **gasto de marketing mensual** en
   `analytics_config/marketing`. Con eso: `CAC = gasto ÷ nuevos pagos` y, junto al
   LTV, el semáforo `LTV/CAC`. *Esfuerzo: bajo (form) + criterio del dueño.*
6. **Instrumentar más `cta_click`** (botones "Crear contrato", "Entrar como
   inquilino", etc.) para medir intención antes del registro. *Esfuerzo: trivial.*

Con 1–5 el tablero queda **100% auto-alimentado** salvo el gasto de marketing
(dato que solo tú conoces), que se captura una vez al mes.

## 7. Estado en ArriendoSeguro (se irá actualizando)

- **Hecho**: visitas GA4 (panel + Telegram), embudo derivado
  (Encuestas→Registrados→Contratos→Firmados), compras (Plan Plus), corrección del
  conteo de pagos (`APPROVED`).
- **Hecho (2026-08-29)**: **contador de visitas propio sin cookies** (§4.3) en la
  tarjeta Adquisición; **conciliación de ingresos** en 3 capas (webhook + retorno +
  barrido diario) para que ningún pago quede sin contar.
- **Pestaña Lean**: tarjetas AARRR, **ingresos $** (total / 30 días / ticket /
  ARPU), motores de crecimiento (viral/sticky/pagado), North Star y **bar chart
  race** semanal.
- **Fase de eventos (hecho)**: `lib/analytics/{events,track}.ts` +
  `/api/analytics/event` (colección `analytics_events`); instrumentado el
  **drop-off del asistente** (`nuevo_step`/`nuevo_review`/`nuevo_completed`) y la
  **micro-encuesta de abandono** (`abandon_reason`/`page_abandon`). Visible en
  Lean → "Por qué se van" y "Dónde se caen en el asistente".
- **Siguiente**: instrumentar `reached_payment` (llegó a la pasarela) para cerrar
  el embudo desde la visita, y el **semáforo de cohortes** semanal 🟢🟡🔴.

_Referencia viva; actualízalo al evolucionar el módulo._

---
---

# BLOQUE 2 — ELEVATOR PITCH / PLAN DE NEGOCIO (prototipo)

> Prototipo de "pitch de inversión" de **ArriendoSeguro** (producto de **LOTIC**).
> Reutilizable: un agente puede tomar esta estructura para armar el pitch de otra
> app. Las cifras marcadas *(estimado)* deben reemplazarse por las reales de cada
> negocio. Se conecta con el **tablero de KPIs** del Bloque 1 (la medición del
> pitch se hace con esos indicadores en vivo).

## 1. Resumen ejecutivo (30 segundos)
En Colombia **7,2 millones de hogares viven en arriendo** (40,3% del total, DANE
ECV 2023) y **la mayoría del mercado es informal/directo**, sin inmobiliaria.
Esos arrendadores y arrendatarios hacen contratos "a mano", sin respaldo legal,
sin firma válida, sin historial de cumplimiento y con miedo a estafas.
**ArriendoSeguro es la primera plataforma que digitaliza TODO el ciclo del
arriendo directo —crear el contrato legal, firmarlo, gestionar pagos, inventario,
reputación y cierre— en un flujo fácil, guiado por IA, a un costo mínimo
($49.900 por contrato).** Democratizamos lo que hoy solo tienen las inmobiliarias.

**La app ya está construida y en producción.** No pedimos plata para desarrollar:
pedimos inversión para **marketing** y para sostener las plataformas mientras
crecemos.

## 2. El problema (necesidad del mercado)
- **7,2M hogares en arriendo** en Colombia (DANE 2023); ~**la mitad o más lo hace
  de forma informal/directa** (baja intermediación inmobiliaria formal, mercado
  cada vez más informal — estudios BID/prensa).
- El arriendo directo hoy significa: contratos genéricos bajados de internet (a
  veces nulos), **sin firma con validez legal**, sin evidencia de pagos, sin
  forma de conocer la **reputación** de la otra parte, y trámites de cierre
  (paz y salvo, actas) improvisados.
- Las **inmobiliarias** cobran ~un mes de canon + mensualidades y no atienden al
  arrendador pequeño que solo quiere un ingreso complementario.
- Resultado: **millones de personas sin herramientas**, expuestas a incumplimientos
  y estafas. Esa es la brecha que cerramos.

## 3. La solución (qué hacemos — extremo a extremo)
Un solo lugar para **todo el ciclo del arriendo**:
1. **Crear el contrato** de vivienda urbana conforme a la **Ley 820 de 2003**, con
   validaciones legales (tope de canon, preavisos, cláusulas).
2. **Invitar** a inquilino y codeudor (llenan sus datos y suben soportes por enlace).
3. **Firma electrónica con evidencia** (Ley 527 de 1999): fecha, IP, hash.
4. **Inventario guiado con fotos + acta de entrega.**
5. **Pagos**: calendario, recordatorios, comprobantes y escalamiento.
6. **Novedades, mantenimiento y solicitudes** entre las partes.
7. **Reputación privada** bidireccional (dueño↔inquilino), con consulta y
   certificado compartible (QR).
8. **Cierre**: terminación/no renovación (Ley 820), paz y salvo, custodia o
   descarga del expediente.
9. **IA integrada**: asistente para crear el contrato por voz, validación
   antifraude de documentos (visión), moderación, motor legal.

## 4. Nuestros 3 pilares
| Pilar | Qué significa | Por qué gana |
|---|---|---|
| **1. Todo en uno (extremo a extremo)** | Del contrato al cierre, sin saltar entre apps/abogados/inmobiliarias | Nadie más cubre TODO el ciclo del arriendo directo |
| **2. Fácil + flujo progresivo + IA** | "Una pregunta a la vez", guiado, con IA y voz; usable por adultos mayores | Elimina la fricción legal/técnica que asusta al usuario informal |
| **3. Muy bajo costo — democratizar** | $49.900 por contrato (vs. ~1 mes de canon de una inmobiliaria) | Abre el mercado a los millones que hoy quedan por fuera |

## 5. Mercado objetivo y tamaño (TAM / SAM / SOM)
| Nivel | Definición | Hogares | Base del cálculo |
|---|---|---|---|
| **TAM** | Todos los hogares en arriendo en Colombia | **7,2 M** | DANE ECV 2023 (40,3% de 18M) |
| **SAM** | Arriendo **informal/directo** (sin inmobiliaria) — nuestro foco | **~3,6 M** *(≈ la mitad; probablemente más)* | Estimación conservadora sobre baja intermediación formal |
| **SOM** | Meta aspiracional de penetración (~30% del SAM en el largo plazo) | **~1,08 M** | Aspiración; hitos cercanos mucho más modestos |

Solo **1% del SAM (~36.000 contratos)** a $49.900 ≈ **$1.795 millones COP** de
ingresos potenciales; la penetración se construye por fases (ver §10).
*Nuestro foco NO son las inmobiliarias (la otra mitad); es el arrendador directo.*

## 6. Competencia
| Competidor | Qué hace | Dónde no llega (nuestra ventaja) |
|---|---|---|
| **Inmobiliarias tradicionales** | Administran el arriendo cobrando comisión mensual | Caras; no sirven al arrendador pequeño/directo; poco digitales |
| **Contract Me / generadores de contratos** | Generan el documento | Solo el contrato; sin firma+pagos+reputación+cierre |
| **Houm / marketplaces** | Publican y conectan inmuebles | Enfocados en conseguir inquilino, no en gestionar el ciclo |
| **Plantillas gratis / "a mano"** | Documento genérico | Sin validez, sin evidencia, sin historial |

**Nuestro moat:** (a) **reputación privada** que crece con cada arriendo (efecto
red y datos propios difíciles de copiar) + (b) **motor legal Ley 820/527** + (c)
**costo marginal casi cero** por nuestra arquitectura.

## 7. Ventajas y desventajas (honestas)
**Ventajas:** producto ya construido; costo operativo bajísimo; cobertura E2E
única; IA que reduce fricción; datos de reputación como activo defendible;
fundador técnico (dev + mantenimiento sin costo).
**Desventajas / riesgos:** marca nueva (confianza por construir); marketing
incipiente; educación de mercado (usuarios informales); dependencia de
proveedores (pagos, IA, mensajería); marco legal que exige asesoría (mitigado con
disclaimers y aliados abogados).

## 8. Modelo de negocio e ingresos
- **Pago por contrato (precio de introducción): $49.900** (incluye firma
  electrónica con evidencia, inventario/acta, pagos, reputación, cierre).
- **Contrato gratis por referidos** (invita 3, usan 2) → viralidad.
- **Plan Plus** por contrato para funciones premium (firma/descarga).
- **Aliados (terceros):** seguros de arrendamiento, estudio de crédito, notaría,
  cobranza, abogados → comisión/lead.
- **Publicidad** (AdSense/house ads) en el plan gratuito.
- Futuro: **hub de pagos** para cobrar a otras apps (ya construido, apagado).

## 9. Costos y estructura financiera
**Lo que NO cuesta:** desarrollo (fundador) y mantenimiento (fundador) = **$0**.
**Costos de plataforma (estimado, etapa inicial):**
| Servicio | Uso | Costo mensual estimado |
|---|---|---|
| Vercel (hosting) | App Next.js | ~US$20 (~$80.000) |
| Firebase (Firestore/Storage/Auth) | Base de datos y archivos | US$0–25 (empieza en free) |
| Resend (correo) | Notificaciones | US$0–20 (free hasta 3k/mes) |
| WhatsApp/Meta | Mensajes por conversación | por contrato → **costo variable** |
| IA (Groq/Gemini gratis → OpenAI pago) | Asistente/validación | por contrato → **costo variable** |
| Dominio + varios | | ~US$1–5 |
| **Marketing (inversión principal)** | pauta + contenido + adquisición | **$1.500.000/mes** *(valor medio; escalar con resultados)* |
| **Total FIJO mensual (infra base + marketing)** | | **~$1,8M COP** |

> Los servicios que cobran **por uso** (Firebase, Resend, Vercel, WhatsApp, IA)
> crecen **por contrato**, así que van en el **costo variable** (abajo), no en el
> fijo. Las líneas de Vercel/Firebase/Resend de arriba son solo su **base mínima
> mensual**, que sube por **escalones** al cambiar de plan.

**Costo variable por contrato: ~$6.000** (valor conservador). Incluye WhatsApp,
SMS, IA y el **uso por contrato** de Firebase, Resend y Vercel — por eso escala
solo con el volumen. **+ Pasarela de pago ~4,9% del precio (~$2.450/contrato).**
→ **Contribución neta por contrato ≈ $41.450 (margen neto ~83%)**.

**Palancas adicionales del modelo (editables en la calculadora en vivo):**
- **% RRHH (empleados):** cuando haya nómina, se modela como un **% del ingreso**
  (benchmark de referencia ~**20–30%** en SaaS/servicios; se arranca en **0%** hoy,
  que el fundador opera sin nómina). Baja la contribución efectiva por contrato.
- **Comisión de pasarela:** **~4,9%** del precio (editable) ≈ **$2.450/contrato**.
- **Contribución EFECTIVA por contrato = precio − variable − pasarela − RRHH.**

> La pestaña **Pitch** de `/admin` tiene una **calculadora en vivo** donde TODOS
> estos valores son editables (precio, costo variable, infra fija, marketing,
> **% RRHH**, **% pasarela**, **umbral y % de impuesto de renta**, **% de equity
> cedido al inversionista**) y un interruptor **Por mes / Por año**; todo recalcula
> al instante y alimenta el **Resumen anual** (P&L) de abajo.

## 10. Proyecciones financieras (escenarios)
- **Precio** $49.900 · **costo variable** $6.000 → **contribución $43.900 (88%)**.
- **Costos fijos:** infra base ~$300.000/mes + **marketing $1.500.000/mes**.
- **Dos puntos de equilibrio:** ~**7 contratos/mes** (solo infra) · ~**41 contratos/mes** (incluyendo marketing).
- **Mensual vs anual:** cada contrato es una **venta única** de $49.900 (arriendo de ~1 año); "contratos/mes"
  es el ritmo de **firmas nuevas** por mes. La tabla es **mensual**; para la vista **anual** multiplica los
  ingresos y utilidades por 12 (el costo cargado por contrato es idéntico). El tablero tiene un interruptor
  **Por mes / Por año**.

| Escenario | Contratos/mes | Ingreso/mes | Utilidad ANTES de mkt | Utilidad DESPUÉS de mkt | Costo cargado/contrato |
|---|---|---|---|---|---|
| Equilibrio (infra) | 7 | ~$349.300 | ~$7.300 | ~−$1,49 M | ~$263.000 |
| Conservador | 50 | ~$2,50 M | ~$1,90 M | ~$395.000 | ~$42.000 |
| Base | 200 | ~$9,98 M | ~$8,48 M | ~$6,98 M | ~$15.000 |
| Optimista | 800 | ~$39,9 M | ~$34,8 M | ~$33,3 M | ~$8.250 |
| **Escalón de infra** (400 contratos, infra sube a $1,2M) | 400 | ~$19,96 M | ~$16,36 M | ~$14,86 M | ~$12.750 |

*(La "utilidad después de marketing" es negativa hasta ~41 contratos/mes: ese es
el rango de inversión inicial, cubierto por los fondos que buscamos. El escenario
"Escalón de infra" muestra que, aun subiendo la infra base 4× por un plan mayor,
la utilidad sigue muy sana gracias a que el costo variable ya absorbe el uso.)*

## 10.1 Economía de escala
Dos tipos de costo, y crecen distinto:

1. **Costo variable ($6.000/contrato):** los servicios que cobran por uso
   (Firebase, Resend, Vercel, WhatsApp, IA) están **aquí**, así que **escalan
   solos**: a 1.000 contratos el modelo ya cuenta $6.000.000. El margen **no se
   infla** al crecer.
2. **Costos fijos (infra base + marketing):** no crecen por contrato; se
   **reparten** entre más contratos. Por eso el **costo cargado por contrato BAJA**
   al escalar:

| Contratos/mes | Costo cargado por contrato |
|---|---|
| 7 | ~$263.000 |
| 50 | ~$42.000 |
| 200 | ~$15.000 |
| 800 | ~$8.250 |

- La **infra base** sube por **escalones** (Vercel Pro, Firebase Blaze, Resend
  pago), no de forma lineal → se presupuesta el **próximo escalón**, no un aumento
  suave por contrato.
- Fórmula operativa: **`Utilidad real = contribución × contratos − infra − marketing`**.

### Impuesto de renta
Mientras la operación sea pequeña (persona natural), no hay renta a pagar. Al
**superar el umbral** (~$183M de utilidad anual) empieza a aplicar impuesto. Como
**persona natural** la renta es **progresiva por tramos** (marginal hasta ~39%), no
un 35% plano —ese 35% es la tarifa de una **empresa/SAS**—, por lo que la tarifa
**efectiva** es menor. El tablero lo muestra en el **Resumen anual** como "Utilidad
después de impuestos", con umbral y tasa **editables**.

### Reparto con el inversionista (equity)
El **Resumen anual** modela cuánto del beneficio queda para el fundador vs. el
inversionista según el **% de la empresa cedido** (equity, editable). Sobre la
**utilidad anual después de impuestos** se aplica: **Del inversionista = utilidad ×
equity%** y **Tu parte = utilidad × (1 − equity%)**. Sirve para simular en vivo
"¿cuánto me queda si cedo X%?".

### Estructura del Resumen anual (P&L de 12 meses)
Para un ritmo objetivo de contratos/mes, la tarjeta anual encadena:
**Ingreso anual** (contratos/mes × 12 × precio) **− costo variable − pasarela −
RRHH − infra − marketing = utilidad operativa anual**; **− impuesto de renta
(si supera el umbral) = utilidad después de impuestos**; **→ reparto Tu parte /
Del inversionista**. Incluye la cifra destacada de mercado: *"Solo 1% del SAM
(~36.000 contratos) × $49.900 ≈ $1.795 M COP (DANE ECV 2023)"*.

## 11. Cómo lo medimos (tablero de KPIs — Bloque 1)
Todo el pitch se **audita en vivo** con el tablero `/admin → Lean`:
- **North Star:** arriendos activos gestionados.
- **AARRR:** adquisición → activación → retención → ingresos → referidos.
- **Tráfico:** visitas GA4 (con consentimiento) **+ visitas propias sin cookies**
  (independientes del consentimiento) → número real desde el día 1.
- **Ingresos conciliados:** solo pagos aprobados, con 3 capas anti-pérdida.
- **Unit economics:** **LTV / CAC** (sano ≥ 3×), ticket, tiempo a convertir.
- **Motor de crecimiento:** coeficiente viral *k* (referidos), retención (sticky).
- **Innovación:** semáforo de cohortes 🟢🟡🔴 (¿mejora el motor semana a semana?).
- **Abandono y drop-off** para saber dónde perdemos usuarios y por qué.
Esto le da al inversionista **evidencia real y actualizada**, no promesas.

## 12. La inversión que buscamos
- **Uso de fondos:** (1) **marketing** (pauta, contenido, adquisición) — la palanca
  que hoy manejamos "tímidamente"; (2) **colchón de costos de plataforma** durante
  el crecimiento; (3) opcional: alianzas legales y de seguros.
- **No** para desarrollo ni nómina técnica (cubierto por el fundador).
- **Retorno:** con margen de contribución ~88%, equilibrio ~7 contratos/mes sin
  marketing y ~41 incluyéndolo, cada peso de marketing eficiente se traduce casi
  directo en margen a partir de ahí.

## 13. Por qué somos los mejores / por qué ahora
- **Momento:** el arriendo crece (40,3% y subiendo) y se informaliza → más gente
  desprotegida que necesita justo esto.
- **Producto listo y probado**, con IA y flujo para el usuario real (incl. adultos
  mayores).
- **Costo estructural imbatible** (dev/mantenimiento propios) → podemos ofrecer el
  precio más bajo del mercado y aún así tener alto margen.
- **Datos de reputación** que se vuelven un activo defendible con cada contrato.

## 13.1 Preguntas frecuentes del inversionista
- **¿Quién es el cliente objetivo (nicho)?** Arrendadores directos —personas
  naturales con uno o más inmuebles en arriendo— en toda Colombia, de 25 a 70
  años. Foco en 25–60 por adopción digital; 60–70 son menos digitales y para ellos
  la app trae voz y flujo de una pregunta a la vez. Expansión natural a toda
  Latinoamérica.
- **¿Cómo se genera el ingreso?** Venta única de $49.900 por contrato (incluye
  firma), más firma certificada, plan Plus, aliados (abogados/seguros/cobranza) y
  publicidad; recurrencia anual por renovaciones.
- **¿Cómo se adquieren clientes y a qué costo?** Marketing digital, contenido/SEO y
  referidos, medido en el tablero (CAC y LTV/CAC ≥ 3×); se escala solo lo que rinde.
- **¿Qué los hace defendibles (moat)?** Reputación privada bidireccional (datos
  propios), motor legal (Ley 820/527) y costo marginal casi cero.
- **¿Estado y tracción?** Producto terminado y en producción de punta a punta;
  métricas en vivo.
- **¿Riesgos y mitigación?** Adopción (voz/IA/flujo simple), legal (motor Ley 820 +
  aliados), pagos (HMAC + trazabilidad), plataformas (costos por uso, escalables).
- **¿Escalable a otros países?** Sí; arquitectura multi-país (zonas horarias y
  textos legales dinámicos), motor legal adaptable por país.
- **¿Y si una inmobiliaria grande lo copia?** Va contra su modelo de comisión
  mensual, y el moat de reputación se construye con años de datos propios.
- **¿Equipo y uso de fondos?** Fundador que desarrolla y opera (dev $0) bajo LOTIC;
  la inversión va a marketing y colchón de plataforma, no a desarrollo ni nómina.

## 14. Roadmap (resumen)
Lanzamiento → tracción por referidos → alianzas (seguros/abogados/notaría) →
firma certificada del Estado → **hub de pagos** para monetizar otras apps →
expansión regional (arquitectura ya preparada para otros países/monedas).

---

## NOTA FINAL (para agentes que reutilicen este documento)
Los **nombres de tablas, colecciones, campos, endpoints, variables y cifras** que
aparecen en este documento (p. ej. `analytics_events`, `analytics_pageviews`,
`platform_payments`, `platform_orders`, `/api/metrics/pageview`,
`/api/admin/dashboard`, `hub_apps`, `admin_config/marketing`, `$49.900`, costos,
DANE 7,2M, etc.) son **referencias de lo implementado en ArriendoSeguro**. Si un agente usa este
documento para construir lo mismo en **otra aplicación**, debe **mapear cada uno a
lo que exista en SU propia app** (sus colecciones, su modelo de datos, sus
proveedores, su mercado y sus cifras reales), y **validar los datos de mercado con
las fuentes oficiales de su país/segmento**. Nada aquí debe copiarse literal sin
adaptarlo al contexto real de la aplicación destino.

**Fuentes de mercado (Colombia):**
- DANE — Encuesta Nacional de Calidad de Vida (ECV) 2023: [boletín](https://www.dane.gov.co/files/operaciones/ECV/bol-ECV-2023.pdf) · [nota La República](https://www.larepublica.co/economia/resultados-de-la-encuesta-de-calidad-del-vida-del-dane-en-2023-3847523) · [Infobae](https://www.infobae.com/colombia/2024/04/25/casi-la-mitad-de-los-hogares-en-colombia-viven-en-arriendo-segun-informe-del-dane/)
- Informalidad / baja intermediación del arriendo: [Estudio BID sobre el mercado de arrendamiento en Colombia](https://publications.iadb.org/publications/spanish/document/Estudio-sobre-el-mercado-de-arrendamiento-de-vivienda-en-Colombia.pdf)
