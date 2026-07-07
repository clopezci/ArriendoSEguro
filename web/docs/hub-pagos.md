# Hub de pagos de ArriendoSeguro

Guía para conectar una **aplicación externa** (incluidas apps en Supabase) al hub
de pagos de ArriendoSeguro. El hub usa **una sola cuenta Wompi central**: las apps
no necesitan su propia cuenta de Wompi, solo consumen estos extremos.

```
App externa ──(1) POST /api/hub/orders──►  Hub (arriendoseguro.app)  ──► Wompi
     ▲                                             │
     └──(4) webhook firmado (aprobado/rechazado) ◄─┘ (3) Wompi confirma al hub
                    (2) el cliente paga en la checkoutUrl
```

- **Base URL:** `https://arriendoseguro.app`
- **Autenticación:** API key + firma HMAC en cada petición.
- **El dinero** entra a la cuenta Wompi central de ArriendoSeguro. El reparto/pago
  a cada app es un proceso administrativo aparte (no automático).

---

## 1. Registrar la app (una vez)

En `/admin` → sección **"Hub de pagos (apps externas)"**:

1. Ingresa **nombre** y **URL de webhook** de la app (a dónde notificaremos el
   estado de cada pago).
2. Pulsa **Registrar app**. Se muestran **una sola vez**:
   - `apiKey` (empieza en `hubk_`)
   - `hmacSecret` (empieza en `hubs_`)
3. Guárdalos como variables de entorno en la app externa (`HUB_API_KEY`,
   `HUB_HMAC_SECRET`). Si se pierden, se registra otra app.

> Alternativa headless: `npm run hub:register -- --name="MiApp" --webhook="https://miapp.com/api/hub/webhook"`
> (requiere el service account local y `ADMIN_INTERNAL_ENABLED=true`).

---

## 2. Firma HMAC (en ambos sentidos)

Todas las peticiones (entrantes y salientes) se firman igual:

```
signature = HMAC_SHA256( hmacSecret , `${timestamp}.${rawBody}` )   // hex
```

- `timestamp` = milisegundos (`Date.now()`), va en el header `x-hub-timestamp`.
- La firma va en `x-hub-signature`.
- Ventana anti-replay: **5 minutos**.
- En peticiones sin cuerpo (GET), `rawBody` es la cadena vacía (`""`).

---

## 3. Crear una orden de cobro

`POST /api/hub/orders`

**Headers:** `x-hub-key`, `x-hub-timestamp`, `x-hub-signature`, `content-type: application/json`

**Body:**

| Campo | Req. | Descripción |
|-------|------|-------------|
| `amountInCents` | sí | Monto en centavos (COP × 100). Ej.: `4990000` = $49.900 |
| `redirectUrl` | sí | A dónde vuelve el cliente tras pagar (una URL de tu app) |
| `currency` | no | Por defecto `COP` |
| `customerEmail` | no | Se pre-llena en el checkout |
| `customerFullName` | no | Nombre del cliente |
| `externalReference` | no | Tu ID interno; te lo devolvemos en el webhook |
| `metadata` | no | Objeto libre; te lo devolvemos en el webhook |

**Respuesta:** `{ success, orderId, reference, checkoutUrl, status }`
→ Redirige al cliente a `checkoutUrl` para que pague.

```js
import crypto from "node:crypto"; // en Supabase Edge: Deno tiene el mismo API vía node:crypto

const body = JSON.stringify({
  amountInCents: 4990000,
  currency: "COP",
  customerEmail: "cliente@correo.com",
  redirectUrl: "https://miapp.com/pago/retorno",
  externalReference: "pedido-123",
  metadata: { plan: "pro" },
});
const timestamp = Date.now().toString();
const signature = crypto.createHmac("sha256", process.env.HUB_HMAC_SECRET)
  .update(`${timestamp}.${body}`).digest("hex");

const res = await fetch("https://arriendoseguro.app/api/hub/orders", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-hub-key": process.env.HUB_API_KEY,
    "x-hub-timestamp": timestamp,
    "x-hub-signature": signature,
  },
  body,
});
const { orderId, reference, checkoutUrl } = await res.json();
```

---

## 4. Recibir el resultado (tu webhook)

Cuando la transacción cambia de estado, el hub hace `POST` a tu **URL de webhook**
con la firma. **Verifica la firma antes de confiar.**

**Headers que enviamos:** `x-hub-timestamp`, `x-hub-signature`, `x-hub-event`

**Body:**
```json
{
  "type": "payment.updated",
  "orderId": "…",
  "reference": "HUB_…",
  "externalReference": "pedido-123",
  "status": "approved",          // approved | rejected | pending
  "wompiStatus": "APPROVED",
  "amountInCents": 4990000,
  "currency": "COP",
  "providerPaymentId": "…",
  "metadata": { "plan": "pro" }
}
```

```js
// En tu endpoint (ej. /api/hub/webhook)
const raw = await request.text();
const ts  = request.headers.get("x-hub-timestamp");
const sig = request.headers.get("x-hub-signature");
const expected = crypto.createHmac("sha256", process.env.HUB_HMAC_SECRET)
  .update(`${ts}.${raw}`).digest("hex");
if (expected !== sig) return new Response("bad signature", { status: 401 });

const evt = JSON.parse(raw);
if (evt.status === "approved") {
  // activa el servicio/plan del cliente usando evt.externalReference / evt.metadata
}
return new Response("ok");
```

> Responde `2xx` para confirmar recepción. La entrega es *mejor esfuerzo*; si tu
> webhook falla, siempre puedes consultar el estado (paso 5).

---

## 5. Consultar estado (respaldo)

`GET /api/hub/orders/{orderId}` con los mismos headers de auth (cuerpo vacío, se
firma `${timestamp}.`). Devuelve `{ success, order: { status, amountInCents, … } }`.

---

## Notas de seguridad y operación

- La `apiKey` se guarda **hasheada** (SHA-256); el `hmacSecret` no se puede volver
  a consultar tras crearlo.
- **Idempotencia:** si Wompi reintenta el webhook, no se duplica el pago.
- **Validación:** el hub rechaza (422) si el monto o la moneda no coinciden con la
  orden.
- **Desactivar** una app en `/admin` invalida sus llamadas de inmediato.
- Todo pasa por la misma cuenta Wompi central; la **conciliación/pago** a cada app
  es administrativa.
