# Módulo de indicadores (Lean Startup) — diseño reusable

Guía para montar un **tablero de indicadores** que mida el desempeño de una app
desde la óptica de *Lean Startup*, con métricas accionables (no "de vanidad").
Está escrito para reutilizarse en **otras aplicaciones** (TiendaFácil, Criterio
Nacional, TransformaDigital, etc.): la primera parte es teoría + modelo mental;
la segunda es la arquitectura técnica portable; la tercera, el checklist de
implementación por app.

> En ArriendoSeguro este módulo vive en `/admin` (pestaña **Lean**), se alimenta
> de Firestore + Google Analytics 4 (GA4 Data API) y se resume cada día por
> Telegram. Ver también `docs/GA4-VISITAS-TELEGRAM.md`.

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
- **[base]** Visitas por día (usuarios GA4) + serie 14/30 días.
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
- **[base]** **Ingresos $** (suma de pagos aprobados) total / 30 días / hoy.
- **[base]** **Ticket promedio** = ingresos ÷ nº de pagos.
- **[base]** **ARPU** = ingresos ÷ usuarios activos.
- **[base]** Conversión **contrato → pago**.
- **[cfg]** **LTV** ≈ ticket × nº medio de contratos por cliente (× margen).

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

> **Reutilización:** el par GA4 (`ga4.ts`) + `analytics_events` + el cálculo AARRR
> es idéntico en cualquier app Next.js + Firebase. Cambian solo (1) qué colecciones
> se derivan y (2) qué eventos se instrumentan. Copia `lib/observability/ga4.ts`,
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

## 7. Estado en ArriendoSeguro (se irá actualizando)

- **Hecho**: visitas GA4 (panel + Telegram), embudo derivado
  (Encuestas→Registrados→Contratos→Firmados), compras (Plan Plus), corrección del
  conteo de pagos (`APPROVED`).
- **En este módulo**: pestaña **Lean** con tarjetas AARRR, **ingresos $** (total /
  30 días / ticket / ARPU), motores de crecimiento (viral/sticky/pagado),
  North Star y **bar chart race** semanal.
- **Siguiente (fase evt)**: `analytics_events` + instrumentar drop-off del
  asistente `/nuevo` y el evento "llegó a pagar" para el embudo por cohortes
  completo desde la visita.

_Referencia viva; actualízalo al evolucionar el módulo._
