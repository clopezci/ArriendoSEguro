# Integración Wompi — Arquitectura compartida entre apps de LOTIC Soluciones

> **Para futuros agentes que trabajen en cualquier app del comercio**: leer
> este doc COMPLETO antes de modificar nada relacionado con Wompi.

---

## Contexto: un solo comercio, múltiples apps

Carlos López tiene la cuenta Wompi **"LOTIC Soluciones"** que es su paraguas
comercial. Bajo esa cuenta operan / operarán varias apps:

- ✅ **swap_** — SwapStickers (app de temporada, Mundial 2026)
- 🚧 **transfdig_** — transformacion-digital (en desarrollo, sin tráfico aún)
- 📅 **arriendo_** — arriendoseguro.app (siguiente; será el hub futuro)
- 📅 (3 apps más en pipeline)

Wompi NO permite múltiples "comercios" técnicamente independientes bajo una
misma cuenta jurídica. **Un comercio = una entidad legal = un set de llaves
API = UN webhook URL**.

Para que múltiples apps puedan operar bajo el mismo comercio, usamos el
patrón **Webhook Hub**:

```
                  Wompi (un solo webhook URL)
                         │
                         ▼
              ┌──────────────────────┐
              │  Webhook HUB         │  (vive en UNA app — hoy SwapStickers)
              │  /api/wompi/webhook  │
              └──────────┬───────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
        swap_*       transfdig_*  arriendo_*
       (procesa     (reenvía a   (reenvía a
         local)      esa app)     esa app)
```

Cada transacción que cualquier app crea con Wompi lleva un campo `reference`
que **DEBE empezar con el prefijo único de esa app**. El hub usa ese prefijo
para enrutar.

---

## Estado actual del HUB

| Aspecto | Valor actual |
|---|---|
| App que aloja el hub | **SwapStickers** (`https://appstickers.app`) |
| URL del webhook en Wompi | `https://appstickers.app/api/wompi/webhook` |
| Prefijos activos | `swap_` (procesa local), `transfdig_` (reenvía) |
| URLs de forward configuradas | `wompi_forward_transfdig_url` en `app_settings` |
| App futura del hub | **arriendoseguro.app** (cuando esté en producción) |

---

## Cómo funciona el hub (algoritmo)

Cuando Wompi envía un evento al webhook:

1. **Validar checksum** (`signature.checksum` con sha256 del payload + secret).
2. Si checksum inválido → 401 + log con outcome `rejected`.
3. **Extraer prefijo** del `reference`: todo lo antes del primer `_`.
4. **Si el prefijo es del hub (`swap_`)** → procesar localmente:
   - Para `transaction.updated` con status `APPROVED`:
     - Decodificar UUID del usuario desde el reference.
     - Activar premium en `user_profiles` (vigencia de temporada: fin del
       Mundial + 2 meses, fecha configurable en `app_settings`).
   - Para otros status → log y no hacer nada.
5. **Si el prefijo es de otra app** → reenviar el evento RAW (con el header
   `x-event-checksum` original) a la URL configurada en
   `app_settings.wompi_forward_<prefix>_url`.
6. **Si no hay prefijo o es desconocido** → log con outcome `unknown`,
   devolver 200 a Wompi (no rompemos su flujo).
7. **Siempre**: insertar fila en `payment_events_wompi` con outcome,
   notes, raw_payload, etc. (best-effort, no bloquea respuesta).

---

## Convención de reference scheme

Cada app DEBE construir sus references con este patrón:

```
<prefix>_<purpose>_<userIdNoHyphens>_<timestamp>
```

Por ejemplo:
- `swap_premium_a3f400001234abcd56789012345abcde0_1779749162462`
- `transfdig_subscription_b5e1...0123_1779749200000`

**Reglas:**
- `<prefix>`: única por app, definida en `src/lib/wompi/reference.ts → APP_PREFIX`.
- `<purpose>`: identifica QUÉ está comprando el usuario (`premium`,
  `subscription`, `unlock`, etc.). Solo letras y números.
- `<userIdNoHyphens>`: UUID del usuario sin guiones (32 chars).
- `<timestamp>`: `Date.now()` para garantizar unicidad.

**No usar otros separadores** que no sean `_` — el hub split por `_` para
extraer userId.

---

## Estructura de código (módulo portable)

Estos archivos son **autocontenidos** — pueden copiarse tal cual entre
repos. Solo cambia el `APP_PREFIX` en `reference.ts`.

```
src/
├─ lib/wompi/
│  ├─ types.ts            ← Tipos TS de Wompi
│  ├─ signature.ts        ← Hash sha256 integridad + verifyWebhookChecksum
│  ├─ reference.ts        ← APP_PREFIX, buildReference, uuidFromSlug
│  └─ checkout-url.ts     ← Construye URL del Web Checkout
│
└─ app/api/wompi/
   ├─ webhook/route.ts          ← El hub (procesa o reenvía)
   ├─ transaction/route.ts      ← POST: crea transacción y devuelve URL
   └─ transaction/status/route.ts  ← GET: consulta estado (REST API)

src/app/payment/wompi/return/
├─ page.tsx
└─ ReturnClient.tsx       ← Página tras pago: polling status
```

---

## Variables de entorno

En Vercel (Settings → Environment Variables):

```
# Producción (cobra plata real)
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=pub_prod_xxxxx
WOMPI_INTEGRITY_SECRET=prod_integrity_xxxxx
WOMPI_EVENTS_SECRET=prod_events_xxxxx

# Sandbox (pruebas)
NEXT_PUBLIC_WOMPI_PUBLIC_KEY_TEST=pub_test_xxxxx
WOMPI_INTEGRITY_SECRET_TEST=test_integrity_xxxxx
WOMPI_EVENTS_SECRET_TEST=test_events_xxxxx

# Cambia entre 'production' y 'sandbox' SIN cambiar las llaves
NEXT_PUBLIC_WOMPI_ENVIRONMENT=sandbox
```

**Marcar las 6 vars en Production + Preview** en Vercel (Development queda
bloqueado por ser "sensitive", está OK).

Para alternar entre Sandbox y Production en runtime, solo cambia
`NEXT_PUBLIC_WOMPI_ENVIRONMENT` y redeploy. Las llaves NUNCA se mezclan
porque cada flujo lee la pareja correcta.

---

## Settings administrables (Supabase, tabla `app_settings`)

Estos valores los puede editar Carlos desde `/admin/settings` sin tocar
código:

| Key | Default | Uso |
|---|---|---|
| `premium_price_cop` | `1090000` (= $10.900 COP en centavos) | Precio del Premium para Wompi. Cambia si la tasa USD/COP varía. |
| `wompi_forward_transfdig_url` | `https://transformacion-digital-two.vercel.app/api/wompi/webhook` | A dónde reenvía el hub los eventos `transfdig_*`. |

Para añadir una nueva app (ej. `arriendo_`):

```sql
INSERT INTO public.app_settings (key, value, description) VALUES
  ('wompi_forward_arriendo_url',
   '"https://arriendoseguro.app/api/wompi/webhook"'::jsonb,
   'URL forward para eventos arriendo_*');
```

---

## Flujo del usuario al pagar

1. Usuario clic en "Activar Premium" → abre `PremiumUpgradeModal`.
2. Modal hace `fetch('/api/geo/country')` → devuelve `'CO'`, `'US'`, etc.
3. Si país = `CO` → muestra primero **Wompi** ($10.900 COP, Nequi/PSE/Bcol).
   Si país = otro → muestra primero **Paddle** ($2.70 USD, tarjeta intl).
4. Hay un link discreto "Ver otros métodos" que muestra la otra pasarela.
5. Si elige Wompi:
   1. Frontend hace `POST /api/wompi/transaction` (cookie session).
   2. Backend valida user autenticado, lee `premium_price_cop`, construye
      reference + firma de integridad, devuelve `checkoutUrl`.
   3. Frontend hace `window.location.href = checkoutUrl`.
   4. Usuario va a `checkout.wompi.co` / `checkout.co.uat.wompi.dev`,
      escoge método, paga.
   5. Wompi redirige a `https://appstickers.app/payment/wompi/return?id=<txnId>&env=<test|prod>`.
   6. Esa página hace polling cada 2s a `/api/wompi/transaction/status?id=xxx`
      hasta APPROVED, DECLINED, ERROR, o timeout (40s).
   7. Mientras, Wompi llama `/api/wompi/webhook` con el evento.
   8. El hub procesa: activa `is_premium=true`, `premium_expires_at` = fecha de
      corte de temporada (key `premium_season_end_date`, vía `premiumExpiryISO`).
   9. El polling ve APPROVED → muestra "¡Premium activado!".

---

## Cómo migrar el hub a otra app (ej. arriendoseguro)

Esto se hace cuando arriendoseguro.app esté en producción y queramos
moverle la responsabilidad de hub (porque SwapStickers expirará tras la
temporada del Mundial).

### Paso 1 — Copiar el módulo a arriendoseguro

En el repo de arriendoseguro:

```bash
# Copia estos archivos desde SwapStickers tal cual:
src/lib/wompi/types.ts
src/lib/wompi/signature.ts
src/lib/wompi/reference.ts            # ⚠️ cambiar APP_PREFIX a 'arriendo'
src/lib/wompi/checkout-url.ts
src/app/api/wompi/webhook/route.ts    # ⚠️ cambiar la lógica processOurOwn para tu modelo
src/app/api/wompi/transaction/route.ts
src/app/api/wompi/transaction/status/route.ts
src/app/api/geo/country/route.ts
src/app/payment/wompi/return/         # (toda la carpeta)
```

### Paso 2 — Cambiar el prefix

En `src/lib/wompi/reference.ts`:
```typescript
export const APP_PREFIX = 'arriendo'  // antes era 'swap'
```

### Paso 3 — Adaptar `processOurOwn`

La función `processOurOwn` en el webhook tiene lógica específica a cada
app (activar premium en SwapStickers, activar subscription en otra app,
etc.). Reescribir según el modelo de datos de arriendoseguro.

### Paso 4 — Configurar app_settings en SU base de datos

En el Supabase de arriendoseguro, crear la tabla `app_settings` con la
misma estructura de SwapStickers (mig 017) y semilla:

```sql
INSERT INTO public.app_settings (key, value, description) VALUES
  ('wompi_forward_swap_url',
   '"https://appstickers.app/api/wompi/webhook"'::jsonb,
   'Forward de eventos swap_* a SwapStickers (mientras esté activa)'),
  ('wompi_forward_transfdig_url',
   '"https://transformacion-digital-two.vercel.app/api/wompi/webhook"'::jsonb,
   'Forward de eventos transfdig_*');
```

### Paso 5 — Variables de entorno en Vercel de arriendoseguro

Copiar las mismas 6 vars Wompi.

### Paso 6 — Cambiar la URL en Wompi Dashboard

Wompi Dashboard → Desarrollo → Programadores → URL de Eventos:
```
de:    https://appstickers.app/api/wompi/webhook
a:     https://arriendoseguro.app/api/wompi/webhook
```

### Paso 7 — Desactivar el hub en SwapStickers (opcional)

Una vez verificado que arriendoseguro recibe eventos:
- Borrar / desactivar `src/app/api/wompi/webhook/route.ts` en SwapStickers.
- Cambiar `processOurOwn` para que ya NO reciba forwards.

**Tiempo total estimado**: ~30 min.

---

## Tabla de auditoría: payment_events_wompi

Cada evento recibido por el hub queda registrado en `payment_events_wompi`.
Solo admins pueden leerla.

Columnas clave:
- `wompi_txn_id`: ID de la transacción en Wompi (`txn_xxx`)
- `reference`: nuestro identificador (`swap_premium_xxx_xxx`)
- `app_prefix`: prefijo extraído (`swap`, `transfdig`, etc.)
- `status`: estado de la transacción Wompi (APPROVED, DECLINED, etc.)
- `outcome`: qué hicimos con el evento (`processed`, `forwarded`, `rejected`, `unknown`)
- `notes`: mensaje informativo
- `raw_payload`: payload completo (JSONB para debugging)

Para debug rápido en SQL Editor:
```sql
-- Últimos 50 eventos
SELECT created_at, wompi_txn_id, reference, status, outcome, notes
FROM payment_events_wompi
ORDER BY created_at DESC
LIMIT 50;

-- Eventos de un usuario específico
SELECT * FROM payment_events_wompi
WHERE reference LIKE 'swap_premium_%<userIdNoHyphens>%'
ORDER BY created_at DESC;

-- Forwards fallidos
SELECT * FROM payment_events_wompi
WHERE outcome = 'forwarded' AND notes LIKE '%forward_failed%'
ORDER BY created_at DESC;
```

---

## Sandbox testing

### Tarjetas de prueba Wompi

```
APROBADA:    4242 4242 4242 4242  /  cualquier CVC  /  cualquier fecha futura
DECLINADA:   4111 1111 1111 1112
INSUFICIENTE: 4242 4242 4242 4234
```

### Nequi sandbox

Usar número de celular `3991111111` con OTP `123456`.

### PSE sandbox

Seleccionar **"Banco que aprueba"** o **"Banco que rechaza"** del dropdown
para simular cada escenario.

### Para activar modo sandbox en la app

En Vercel: `NEXT_PUBLIC_WOMPI_ENVIRONMENT=sandbox` → redeploy.

Las llaves `pub_test_` + `prv_test_` + secrets test se usarán automáticamente.

---

## Errores comunes y soluciones

### "wompi_not_configured"
Faltan env vars. Verifica que estén las 3 según environment activo
(`NEXT_PUBLIC_WOMPI_PUBLIC_KEY*`, `WOMPI_INTEGRITY_SECRET*`,
`WOMPI_EVENTS_SECRET*`).

### Webhook devuelve 401 "invalid_signature"
El `events_secret` configurado en Vercel no coincide con el que Wompi
usa para firmar. Verifica que ambos sean del mismo environment (prod o
test) y que se copió completo sin espacios.

### Transacción APROBADA pero usuario no aparece como Premium
Mira `payment_events_wompi` para ver el `outcome` y `notes`:
- Si `rejected` con `malformed_reference` o `invalid_uid_slug` → el reference
  no tiene formato esperado (probablemente generado por código viejo).
- Si `rejected` con `user_not_found_xxx` → el UUID extraído no existe en
  `user_profiles`. Probablemente el usuario se borró.
- Si `processed` con `premium_activated_for_xxx` → todo OK, verifica
  `user_profiles.is_premium` y `premium_expires_at` directamente en BD.

### "transaction_default_checkout_url_not_set" (al crear transacción)
En Wompi Dashboard → Configuración → Checkout, definir un Default Payment
Link URL (cualquier URL HTTPS válida de tu dominio). Es un requisito de
cuenta independiente del Web Checkout que usamos.

### El forward falla en logs
Verifica que la URL de forward en `app_settings` esté correcta y que el
endpoint de la otra app esté vivo. Wompi reintenta automáticamente, así
que un fallo temporal se recupera solo.

---

## Diferencias clave vs Paddle

| | Paddle | Wompi |
|---|---|---|
| Moneda | USD | COP |
| Métodos | Tarjeta internacional, PayPal, Apple/GooglePay | Nequi, PSE, Bancolombia, Daviplata, tarjetas locales |
| Checkout | Overlay JS embebido | Redirect a `checkout.wompi.co` |
| Confirmación | Vía RevenueCat webhook | Vía webhook propio + polling status |
| Mercado | Global (excepto algunos) | Solo Colombia |
| Activación premium | RC webhook → mismo handler | Hub webhook → handler propio |

Ambos caminos terminan en el mismo lugar: `is_premium=true` y
`premium_expires_at` = fecha de corte de temporada (fin del Mundial + 2 meses,
configurable en `app_settings.premium_season_end_date`) en `user_profiles`.

---

## Checklist para activar Wompi en producción

- [ ] Aplicar migración `018_wompi_integration.sql` en Supabase SQL Editor.
- [ ] Configurar 6 env vars en Vercel (sandbox + producción).
- [ ] Configurar `NEXT_PUBLIC_WOMPI_ENVIRONMENT=sandbox` primero para test.
- [ ] Redeploy en Vercel.
- [ ] En Wompi Dashboard → URL de Eventos: cambiar a `https://appstickers.app/api/wompi/webhook`.
- [ ] Probar con tarjeta sandbox `4242 4242 4242 4242`.
- [ ] Verificar que `payment_events_wompi` registra el evento con outcome `processed`.
- [ ] Verificar que `user_profiles.is_premium=true` para el comprador.
- [ ] Verificar página `/payment/wompi/return` muestra "Premium activado".
- [ ] Cambiar `NEXT_PUBLIC_WOMPI_ENVIRONMENT=production`.
- [ ] Redeploy.
- [ ] Hacer 1 compra real con tarjeta propia + refund desde Wompi Dashboard.
- [ ] ✅ Listo para vender.
