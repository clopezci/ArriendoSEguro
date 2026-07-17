# Habilitar Bre-B como método de pago (paso a paso)

**Bre-B** es el sistema de pagos inmediatos del **Banco de la República** (llaves + QR,
24/7). Ya quedó montado en la app con la **misma arquitectura de hub que Wompi**:
proveedor `breb`, webhook, y disponible para apps externas por el hub.

> Importante: Bre-B es un **riel**, no una pasarela con API propia de comercio. Se
> cobra **a través de un participante** (tu banco/billetera, o un agregador
> habilitado en Bre-B que exponga API, p. ej. Wompi/Bancolombia, ePayco…). Hay dos
> formas de usarlo, de menor a mayor automatización.

---

## Paso 0 — Consigue tu **llave** Bre-B
En tu banco o billetera (Bancolombia, Nequi, Daviplata, etc.), **registra una llave**
Bre-B para RECIBIR pagos. Puede ser tu **cédula, celular, correo** o una **@llave**
alfanumérica. Esa llave es la que verán quienes te pagan.

---

## Opción A — Modo interno (rápido, sin API): QR + llave, confirmación manual
Sirve para empezar ya, sin integrar un API. La app muestra tu llave + un QR + el
monto; el cliente paga desde su app bancaria y tú **confirmas/concilias** el pago.

En Vercel → **Settings → Environment Variables**:
```
BREB_LLAVE               = (tu llave Bre-B, p. ej. @arriendoseguro o tu celular)
BREB_MERCHANT_NAME       = ArriendoSeguro           (opcional; nombre que ve el pagador)
NEXT_PUBLIC_BREB_ENABLED = true                     (muestra el botón "Pagar con Bre-B")
```
Redeploy. En **Planes** aparece **"Pagar con Bre-B (QR / llave)"** → lleva a una
página interna con tu llave, el QR y el monto. (En este modo **no hay confirmación
automática**: el acceso Plus lo activas tú al ver el pago en tu banco, o con el botón
de prueba en entorno de desarrollo.)

---

## Opción B — Modo API (automático): con un proveedor Bre-B
Cuando tengas un proveedor Bre-B con API (tu banco empresarial o un agregador),
consigue de él: **URL base del API, credencial (API key), secreto del webhook**.

En Vercel:
```
NEXT_PUBLIC_BREB_ENABLED = true
BREB_LLAVE               = (tu llave Bre-B)
BREB_API_BASE_URL        = https://api.tu-proveedor-breb.com
BREB_API_KEY             = (credencial del proveedor)
BREB_WEBHOOK_SECRET      = (secreto para verificar el webhook)
BREB_CREATE_PATH         = /collections        (ruta para crear el cobro; según tu proveedor)
BREB_STATUS_PATH         = /collections        (ruta para consultar estado; según tu proveedor)
BREB_ENVIRONMENT         = production          (o sandbox)
```

**Registra el webhook** en el panel de tu proveedor apuntando a:
```
https://arriendoseguro.app/api/platform-payments/breb-webhook
```
El webhook verifica la firma (`x-breb-signature` = HMAC-SHA256 del cuerpo con
`BREB_WEBHOOK_SECRET`), da el acceso Plus al aprobarse y, si el contrato traía la
cláusula «Otra», recién ahí notifica al abogado.

> **Ajuste de mapeo (una sola vez):** el request/response exacto lo define tu
> proveedor. En `web/src/domain/platform-payments/breb-checkout.ts` (función
> `createBrebCollection`) y en `providers/breb-payment-provider.ts`
> (`parseWebhookEvent`) hay un mapeo tolerante a nombres comunes
> (`paymentUrl`/`qr`/`reference`/`status`…). Si tu proveedor usa otros nombres,
> ajústalos ahí (están marcados). Yo lo dejo listo apenas me pases su documentación.

---

## Usarlo desde OTRAS apps (hub)
Igual que con Wompi, una app externa registrada en el hub (`hub_apps`) crea una orden
y elige el proveedor:
```
POST https://arriendoseguro.app/api/hub/orders
{ "amountInCents": 4990000, "redirectUrl": "https://tu-app/gracias", "provider": "breb" }
```
Responde `{ checkoutUrl, reference, provider: "breb" }`. La confirmación le llega a tu
app por el webhook firmado del hub (igual que con Wompi).

---

## Resumen de lo que TÚ debes hacer
1. Registra tu **llave** Bre-B en tu banco/billetera.
2. **Empezar ya (Opción A):** pon `BREB_LLAVE` + `NEXT_PUBLIC_BREB_ENABLED=true` en Vercel.
3. **Automatizar (Opción B):** consigue un proveedor Bre-B con API, pon sus variables,
   registra el webhook `…/api/platform-payments/breb-webhook`, y pásame su documentación
   para afinar el mapeo de campos.
4. Prueba en **Planes → "Pagar con Bre-B"**.

> Nota: no soy tu asesor financiero/legal; confirma tarifas y condiciones de Bre-B con
> tu banco/proveedor. ArriendoSeguro no custodia el dinero: Bre-B mueve el pago directo
> entre cuentas.
