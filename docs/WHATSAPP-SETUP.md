# Activar WhatsApp (interruptor único, para pruebas y producción)

Modelo de la app: **el correo es la base** (siempre sale, en todos los avisos).
**WhatsApp es un complemento** que se prende/apaga con **UNA sola variable** en
TODOS los bloques a la vez (pagos, mora, reputación, mantenimiento, novedades,
renovación). Así lo prendes para hacer pruebas y lo apagas hasta el lanzamiento.

---

## Prender WhatsApp = 1 interruptor + credenciales

En Vercel → tu proyecto → **Settings → Environment Variables**:

```
NOTIFICATIONS_WHATSAPP_ENABLED = true      ← el interruptor maestro (on/off)
WHATSAPP_CLOUD_TOKEN           = (token permanente de tu app de Meta)
WHATSAPP_PHONE_NUMBER_ID       = (id del número de WhatsApp Business)
WHATSAPP_TEMPLATE_GENERIC      = recordatorio_pago   (tu plantilla aprobada, 1 variable)
WHATSAPP_LANG                  = es                  (opcional; idioma de la plantilla)
```

- Con `NOTIFICATIONS_WHATSAPP_ENABLED=true` **y** las credenciales puestas → todos
  los avisos al celular salen por **WhatsApp** (además del correo).
- **Apagar:** pon `NOTIFICATIONS_WHATSAPP_ENABLED=false` (o bórrala). Todo vuelve a
  salir **solo por correo**, al instante, sin tocar nada más.
- Mientras la plantilla de Meta esté **en revisión** o no pongas credenciales, el
  complemento no envía nada (queda solo el correo), aunque el interruptor esté en `true`.

> `WHATSAPP_TEMPLATE_GENERIC` es una plantilla **utility de 1 variable** que sirve
> para TODOS los avisos (el texto del aviso va en `{{1}}`). Si no la defines, cae a
> `WHATSAPP_TEMPLATE_PAYMENT` o al nombre por defecto `recordatorio_pago`.

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
   - Nombre: `recordatorio_pago` (o el que pongas en `WHATSAPP_TEMPLATE_GENERIC`).
   - Idioma: Español.
   - Cuerpo (con **1 variable**, sirve para TODOS los avisos):
     > Recordatorio de tu arriendo en ArriendoSeguro: {{1}}
   - Meta la aprueba en ~1–2 días.
7. Cuando esté aprobada, pon el interruptor + las credenciales de arriba en Vercel.

**Costo aprox.:** los mensajes "utility" a Colombia cuestan del orden de
US$0.005–0.02 cada uno (más barato que un SMS y con mucha mejor apertura). Los
precios los fija Meta y cambian; confírmalos en su página de precios.

---

## Qué avisos usan el complemento WhatsApp (cuando está encendido)
- Recordatorios de pago (antes y el día del vencimiento) y toda la **mora**.
- **Reputación**: aviso de calificación baja (ventana de réplica de 48h).
- **Mantenimiento/reparaciones**: solicitud reportada y respuesta del dueño.
- **Novedades** del expediente.
- **Renovación**: preaviso de vencimiento del contrato.

El **correo** siempre acompaña (y lleva los enlaces). Con el interruptor apagado,
todos estos avisos salen **solo por correo**.
