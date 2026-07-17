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

### Opcional: aviso de calificación baja por WhatsApp
El aviso al calificado cuando recibe una **calificación baja** (con ventana de 48h
para replicar) sale por **SMS** por defecto. Si quieres que salga por WhatsApp,
crea otra plantilla **Utility** de 1 variable (p. ej. `calificacion_baja`) y añade:

```
WHATSAPP_TEMPLATE_REPUTATION = calificacion_baja
```

Sin esta variable, el aviso de calificación baja sigue saliendo por SMS (y el
correo siempre lo acompaña con el enlace para responder).

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
   - Cuerpo (con **1 variable**, sirve para TODOS los avisos: antes del vencimiento,
     el vencimiento y los días de mora):
     > Recordatorio de tu arriendo en ArriendoSeguro: {{1}}
   - Meta la aprueba en ~1–2 días. (La app manda en {{1}} el texto del recordatorio,
     p. ej. "hoy vence tu arriendo ($1.500.000). Revisa tu correo para pagar y subir el comprobante.")
7. Cuando esté aprobada, pon las 4 variables de arriba en Vercel.

**Costo aprox.:** los mensajes "utility" a Colombia cuestan del orden de
US$0.005–0.02 cada uno (más barato que un SMS y con mucha mejor apertura). Los
precios los fija Meta y cambian; confírmalos en su página de precios.

**Alternativa más fácil de montar (con costo un poco mayor):** Twilio WhatsApp,
que gestiona la relación con Meta por ti. Si prefieres esa vía, avísame y agrego
la rama de Twilio al servicio.

---

## Qué mensajes usan este canal (SMS o WhatsApp)
- Recordatorio **antes** del vencimiento (al inquilino).
- Recordatorio el **día del vencimiento** (al inquilino).
- Recordatorios de **mora** (días posteriores): al inquilino y al **codeudor**,
  cada día hasta que se registre el pago.

El **correo** siempre acompaña (y lleva el enlace para subir el soporte). Las
acciones con enlace de 1 clic (conciliación, aceptar conciliación, retraso y cobro
personal) van por **correo**. Sin credenciales de WhatsApp, todo esto sale por **SMS**.
