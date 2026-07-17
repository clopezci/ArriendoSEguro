# Hub de pagos ArriendoSeguro — Guía de integración para apps externas

Documento técnico para que **otra aplicación (u otro agente)** se conecte al hub de
pagos de ArriendoSeguro y cobre por **Wompi** o **Bre-B** usando la cuenta central,
recibiendo la confirmación por webhook firmado.

- **Base URL (producción):** `https://arriendoseguro.app`
- **Autenticación:** API key + firma **HMAC-SHA256** (anti-replay 5 min).
- **Proveedores:** `wompi` (redirección a checkout externo) o `breb` (QR/llave).

---

## 1) Arquitectura y ubicación de los componentes (en este repo)

Todo vive en `web/src`:

| Componente | Ruta | Qué hace |
|---|---|---|
| **Crear orden** (endpoint) | `app/api/hub/orders/route.ts` | `POST` crea la orden y devuelve `checkoutUrl` |
| **Estado de orden** (endpoint) | `app/api/hub/orders/[id]/route.ts` | `GET` estado de una orden |
| **Auth del hub** | `lib/hub/authenticateHubRequest.ts` | Valida `x-hub-key` + `x-hub-timestamp` + `x-hub-signature` |
| **Firma HMAC** (in/out) | `domain/hub/hub-signature.ts` | `signHubBody` / `verifyHubSignature` (`${timestamp}.${rawBody}`) |
| **Registro de apps** | `domain/hub/hub-apps.ts` | Colección `hub_apps`; genera `apiKey`/`hmacSecret` |
| **Admin de apps** (endpoint) | `app/api/admin/hub-apps/route.ts` | Alta/edición de apps externas (solo admin interno) |
| **Webhook entrante (Wompi)** | `app/api/platform-payments/webhook/route.ts` | Recibe Wompi; refs `HUB_*` → `processHubWompiEvent` |
| **Webhook entrante (Bre-B)** | `app/api/platform-payments/breb-webhook/route.ts` | Recibe Bre-B; refs `HUB_*` → hub |
| **Liquidación del hub** | `domain/hub/hub-webhook.ts` | `processHubWompiEvent`: valida, registra pago, reenvía a tu app |
| **Notificación saliente** | `domain/hub/hub-notify.ts` | `notifyHubApp`: POST firmado a tu `webhookUrl` |
| **Checkout Wompi** | `domain/platform-payments/wompi-checkout.ts` | `buildWompiCheckoutUrl` |
| **Checkout Bre-B** | `domain/platform-payments/breb-checkout.ts` | `createBrebCollection` |

**Colecciones Firestore:** `hub_apps` (apps registradas), `hub_orders` (órdenes),
`hub_payments` (pagos, idempotencia).

---

## 2) Registro de tu app (una vez, lo hace el equipo ArriendoSeguro)

El admin interno crea tu app con `POST /api/admin/hub-apps` (auth de admin):
```json
{ "name": "MiApp", "webhookUrl": "https://mi-app.com/webhooks/arriendoseguro" }
```
Respuesta (los secretos se muestran **UNA sola vez**):
```json
{ "success": true, "apiKey": "hubk_xxxxx…", "hmacSecret": "hubs_xxxxx…",
  "app": { "id": "…", "apiKeyPrefix": "hubk_xxxxxxx", "webhookUrl": "…", "active": true } }
```
Guarda **`apiKey`** y **`hmacSecret`** de forma segura (variables de entorno del lado
servidor de tu app). El `webhookUrl` es a dónde te avisamos el estado de cada pago.

---

## 3) Autenticación (todas las peticiones al hub)

Envía estos headers:
```
x-hub-key:        <tu apiKey en claro>
x-hub-timestamp:  <milisegundos actuales, p. ej. 1737148800000>
x-hub-signature:  HMAC_SHA256( `${x-hub-timestamp}.${rawBody}`, hmacSecret )  (hex)
```
- `rawBody` = el **cuerpo exacto** que envías (para `GET` es **cadena vacía** `""`).
- El timestamp no puede desviarse más de **5 minutos** (anti-replay).
- La firma es sobre el texto `timestamp + "." + body` (no el JSON parseado).

---

## 4) Crear una orden de pago — `POST /api/hub/orders`

**Body:**
```json
{
  "amountInCents": 4990000,
  "currency": "COP",
  "redirectUrl": "https://mi-app.com/pago/retorno",
  "externalReference": "pedido-123",
  "customerEmail": "cliente@correo.com",
  "customerFullName": "Nombre Cliente",
  "provider": "wompi",
  "metadata": { "loQueQuieras": "..." }
}
```
- `amountInCents` (entero, requerido), `redirectUrl` (requerido).
- `provider`: `"wompi"` (def.) o `"breb"`. `currency` def. `COP`.

**Respuesta:**
```json
{ "success": true, "orderId": "…", "reference": "HUB_…", "provider": "wompi",
  "checkoutUrl": "https://checkout.wompi.co/p/?…", "status": "pending" }
```
Redirige a tu usuario a `checkoutUrl` (Wompi externo, o la página de QR/llave de Bre-B).

---

## 5) Consultar estado — `GET /api/hub/orders/:id`

Con los mismos headers de auth (firma con **body vacío**). Respuesta:
```json
{ "success": true, "order": {
  "id": "…", "status": "pending|approved|rejected", "amountInCents": 4990000,
  "currency": "COP", "externalReference": "pedido-123", "reference": "HUB_…",
  "checkoutUrl": "…", "createdAt": "…", "updatedAt": "…" } }
```

---

## 6) Webhook que TÚ recibes (confirmación del pago)

Cuando el pago cambia de estado, el hub hace `POST` a tu `webhookUrl` con:
```
Headers:
  x-hub-timestamp: <ms>
  x-hub-signature: HMAC_SHA256( `${x-hub-timestamp}.${rawBody}`, hmacSecret )  (hex)
  x-hub-event:     payment.updated
Body:
{
  "type": "payment.updated",
  "orderId": "…",
  "reference": "HUB_…",
  "externalReference": "pedido-123",
  "status": "approved" | "rejected" | "pending",
  "wompiStatus": "APPROVED",
  "amountInCents": 4990000,
  "currency": "COP",
  "providerPaymentId": "…",
  "metadata": { ... }
}
```
**Verifica la firma** antes de confiar (mismo esquema). La entrega es *best-effort*:
si tu webhook falla, **siempre** puedes hacer `GET /api/hub/orders/:id` para reconciliar.
El hub es **idempotente** (no repite pagos ya registrados).

---

## 7) Ejemplo (Node.js / TypeScript)

```ts
import { createHmac } from "node:crypto";

const BASE = "https://arriendoseguro.app";
const API_KEY = process.env.HUB_API_KEY!;      // hubk_…
const HMAC = process.env.HUB_HMAC_SECRET!;      // hubs_…

function headers(rawBody: string) {
  const ts = String(Date.now());
  const sig = createHmac("sha256", HMAC).update(`${ts}.${rawBody}`).digest("hex");
  return { "content-type": "application/json", "x-hub-key": API_KEY, "x-hub-timestamp": ts, "x-hub-signature": sig };
}

// Crear orden
const body = JSON.stringify({ amountInCents: 4990000, redirectUrl: "https://mi-app.com/ok", provider: "wompi" });
const res = await fetch(`${BASE}/api/hub/orders`, { method: "POST", headers: headers(body), body });
const { checkoutUrl, orderId } = await res.json();
// → redirige al usuario a checkoutUrl

// Verificar el webhook entrante (en tu servidor)
function verify(rawBody: string, tsHeader: string, sigHeader: string): boolean {
  if (Math.abs(Date.now() - Number(tsHeader)) > 5 * 60 * 1000) return false;
  const expected = createHmac("sha256", HMAC).update(`${tsHeader}.${rawBody}`).digest("hex");
  return expected === sigHeader;
}
```

---

## 8) Proveedores

- **`wompi`** → `checkoutUrl` es el Web Checkout externo de Wompi (tarjeta, PSE, Nequi…).
- **`breb`** → `checkoutUrl` es una página con **QR + llave Bre-B** (pago inmediato del
  Banco de la República). Requiere que ArriendoSeguro tenga Bre-B habilitado
  (ver `docs/BREB-SETUP.md`). La confirmación llega por el mismo webhook del hub.

---

## 9) Errores comunes
| HTTP | `error` | Causa |
|---|---|---|
| 401 | `Faltan credenciales…` | Falta algún header de auth |
| 401 | `API key inválida…` | apiKey mal o app inactiva |
| 401 | `Firma inválida (stale_timestamp)` | Reloj desfasado > 5 min |
| 401 | `Firma inválida (signature_mismatch)` | Firmaste mal (revisa `${ts}.${body}`) |
| 422 | `validation_error` | Body inválido (revisa `issues`) |
| 404 | `not_found` | Orden inexistente o de otra app |

---

## 10) Checklist para el agente/dev de la app externa
1. Pide al equipo ArriendoSeguro el alta de tu app (te dan `apiKey` + `hmacSecret`).
2. Guarda ambos secretos **solo en el servidor** (nunca en el frontend).
3. Implementa el firmado HMAC `${timestamp}.${rawBody}` en cada request.
4. Crea la orden (`POST /api/hub/orders`) y redirige a `checkoutUrl`.
5. Expón tu `webhookUrl`, **verifica la firma** y actualiza tu pedido con `status`.
6. Ante duda, reconcilia con `GET /api/hub/orders/:id`.
7. Elige `provider` `wompi` o `breb` según lo que ofrezcas al usuario.
```
