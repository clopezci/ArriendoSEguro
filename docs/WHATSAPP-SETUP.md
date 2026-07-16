# Activar WhatsApp para los recordatorios (paso a paso)

La función interna **ya está montada** (`services/whatsapp/sendWhatsApp.ts`). Los
recordatorios de pago del **día del vencimiento** pueden salir por **WhatsApp** en
vez de SMS con **solo poner unas variables de entorno** en Vercel. Mientras no las
pongas, sale un **SMS corto** (1 segmento, más barato) — o "mock" si tampoco hay SMS.

---

## Cambiar a WhatsApp = 4 variables en Vercel (cuando tengas la cuenta)
En Vercel → tu proyecto → **Settings → Environment Variables**:

```
PAYMENT_REMINDER_CHANNEL = whatsapp
WHATSAPP_CLOUD_TOKEN      = (token permanente de tu app de Meta)
WHATSAPP_PHONE_NUMBER_ID  = (id del número de WhatsApp Business)
WHATSAPP_TEMPLATE_PAYMENT = recordatorio_pago   (nombre de tu plantilla aprobada)
WHATSAPP_LANG             = es                  (opcional; idioma de la plantilla)
```

Redeploy y listo: los recordatorios salen por WhatsApp. Para volver a SMS, cambia
`PAYMENT_REMINDER_CHANNEL` a `sms` (o bórrala).

---

## Cómo abrir WhatsApp Business (Cloud API de Meta) — la vía oficial y más barata

**Necesitas:** una cuenta de Facebook/Meta y un **número de celular que NO esté ya
en un WhatsApp** (ni personal ni Business App). Ese número será el remitente.

1. **Crea una cuenta de Meta Business:** entra a **business.facebook.com** y crea
   tu "Business Manager" (nombre: LOTIC Soluciones / ArriendoSeguro).
2. **Entra a Meta for Developers:** **developers.facebook.com** → **My Apps** →
   **Create App** → tipo **Business**.
3. En la app, agrega el producto **WhatsApp** → **Set up**.
4. En **WhatsApp → API Setup**: asocia tu Business Manager y **agrega tu número**
   de WhatsApp Business (te enviará un código de verificación por SMS/llamada).
   - Ahí verás el **Phone Number ID** → esa es `WHATSAPP_PHONE_NUMBER_ID`.
5. **Token permanente:** el token que aparece en "API Setup" es temporal (24h).
   Para uno permanente: **Business Settings → Users → System Users** → crea un
   System User → asígnale la app y el número (permiso `whatsapp_business_messaging`)
   → **Generate token** → ese es `WHATSAPP_CLOUD_TOKEN`. Guárdalo bien.
6. **Registra la plantilla** (obligatorio: los mensajes que inicia el negocio deben
   usar plantilla aprobada). En **WhatsApp → Message Templates → Create template**:
   - Categoría: **Utility** (utilidad).
   - Nombre: `recordatorio_pago` (debe coincidir con `WHATSAPP_TEMPLATE_PAYMENT`).
   - Idioma: Español.
   - Cuerpo (con 2 variables): 
     > Hola, hoy vence tu arriendo por {{1}}. Ingresa para pagar y subir tu comprobante: {{2}}
   - Meta la aprueba en ~1–2 días. (La app manda {{1}}=monto, {{2}}=enlace.)
7. Cuando esté aprobada, pon las 4 variables de arriba en Vercel.

**Costo aprox.:** los mensajes "utility" a Colombia cuestan del orden de
US$0.005–0.02 cada uno (más barato que un SMS y con mucha mejor apertura). Los
precios los fija Meta y cambian; confírmalos en su página de precios.

**Alternativa más fácil de montar (con costo un poco mayor):** Twilio WhatsApp,
que gestiona la relación con Meta por ti. Si prefieres esa vía, avísame y agrego
la rama de Twilio al servicio.

---

## Nota
Hoy, sin nada de esto, el recordatorio del día del vencimiento sale como **SMS
corto**. El resto del flujo (escalamiento, conciliación, cobro personal) va por
**correo**. El cambio a WhatsApp no toca ese resto.
