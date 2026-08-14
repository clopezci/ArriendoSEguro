# Guía completa: encender WhatsApp REAL (Meta Cloud API) en ArriendoSeguro

Objetivo: pasar de **modo prueba** a **producción**, usando el número dedicado
**3145721407** para las alertas automáticas, con auto-respuesta que redirige la
atención humana a **3044745676**.

> **Datos que ya tienes** (no se recrean): App de Meta con el producto WhatsApp,
> WhatsApp Business Account (**WABA `1340009818323937`**), número de PRUEBA
> (`phone_number_id 1218376091361914`), token y **2 plantillas** aprobadas
> (`WHATSAPP_TEMPLATE_PAYMENT` y `WHATSAPP_TEMPLATE_GENERIC`).

Links base que usarás:
- Panel de negocio (Business Settings): https://business.facebook.com/settings
- WhatsApp Manager: https://business.facebook.com/wa/manage/
- Centro de seguridad (verificación): https://business.facebook.com/settings/security
- Usuarios del sistema: https://business.facebook.com/settings/system-users
- Tus Apps de desarrollador: https://developers.facebook.com/apps/

---

## FASE 1 — Verificar el negocio (Business Verification)
*Sin esto el número real igual envía, pero con límite bajo (~250 destinatarios/día).
Hazlo ya porque puede tardar días.*

1. Entra a **https://business.facebook.com/settings/security** (Centro de seguridad).
2. Busca **"Verificación del negocio"** → **Empezar / Iniciar verificación**.
3. Completa los datos del negocio. Operas como **persona natural comerciante,
   NIT 71.217.228** (Medellín). Meta puede pedir:
   - Documento del negocio (RUT de la DIAN sirve como documento oficial).
   - Comprobante de domicilio (recibo de servicios público) si lo solicita.
4. Envía y espera el correo de Meta. Puedes seguir con las demás fases mientras tanto.

---

## FASE 2 — Registrar el número real 3145721407
*Requisito: el número NO puede estar activo en la app de WhatsApp / WhatsApp Business
en ningún celular. Como es una SIM nueva sin usar, estás bien.*

1. Entra a **WhatsApp Manager**: https://business.facebook.com/wa/manage/
2. Selecciona tu WABA (`1340009818323937`).
3. Ve a **Números de teléfono → Agregar número de teléfono** (Add phone number).
4. Completa el perfil del remitente:
   - **Nombre para mostrar:** `ArriendoSeguro` (pasa por una revisión corta de Meta).
   - **Categoría:** por ejemplo *"Servicios financieros"* o *"Bienes raíces"*.
   - **Descripción del negocio:** breve (ej. "Contratos de arrendamiento en Colombia").
5. Escribe el número **+57 314 572 1407**, elige verificación por **SMS** o **llamada**.
6. Ingresa el **código** que te llega.
7. Al quedar verificado, entra al número → **copia su `Phone Number ID`**
   (es un número largo, DISTINTO al de prueba). ⬅️ *lo necesitas en la Fase 6.*

---

## FASE 3 — Token permanente (System User)
*El token de la pantalla "API Setup" es temporal (24 h). Para producción necesitas
uno permanente de Usuario del sistema.*

1. Entra a **https://business.facebook.com/settings/system-users**
2. **Agregar** → nombre (ej. `arriendoseguro-api`) → rol **Administrador** → crear.
3. Con el usuario del sistema seleccionado, **Agregar activos**:
   - **Apps** → tu app → activa **Control total**.
   - **Cuentas de WhatsApp** → tu WABA → activa **Control total**.
4. Clic en **Generar nuevo token**:
   - Selecciona **tu App**.
   - **Vencimiento:** *Nunca* (Never).
   - **Permisos:** marca **`whatsapp_business_messaging`** y
     **`whatsapp_business_management`**.
   - **Generar** → **copia el token** (solo se muestra UNA vez; guárdalo bien).
   ⬅️ *este es el valor de `WHATSAPP_CLOUD_TOKEN`.*

---

## FASE 4 — Medio de pago (facturación)
*Sin tarjeta, los envíos reales fallan tras el tramo gratuito.*

1. En **WhatsApp Manager** → tu WABA → **Configuración → Facturación / Pagos**
   (o Business Settings → **Pagos**: https://business.facebook.com/settings/payment_methods).
2. **Agregar método de pago** → tarjeta de crédito → guardar.
3. Verifica que la tarjeta quede **asignada a la WABA** `1340009818323937`.

> Costos: WhatsApp cobra por *conversación* de plantilla (utility). En Colombia una
> utility ronda US$0.005–0.02; además hay un tramo mensual gratuito de conversaciones
> de servicio. Es barato, pero la tarjeta es obligatoria para producción.

---

## FASE 5 — Confirmar las plantillas
1. **WhatsApp Manager → Plantillas de mensajes** (Message templates).
2. Verifica que estén en estado **Aprobada** (Approved):
   - La de **pagos** → su nombre debe coincidir con `WHATSAPP_TEMPLATE_PAYMENT`.
   - La **genérica** → con `WHATSAPP_TEMPLATE_GENERIC`.
3. Anota el **idioma** exacto de cada una (ej. *Spanish (COL)* = `es_CO`) y confirma
   que calce con `WHATSAPP_LANG`.
4. Cada plantilla debe tener **exactamente 1 variable `{{1}}`** en el cuerpo (la app
   manda el mensaje completo en esa variable).

---

## FASE 6 — Variables en Vercel
Entra a tu proyecto en Vercel → **Settings → Environment Variables**. Deja así
(marca **Production**), y al final haz **Redeploy**:

| Variable | Valor |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | **el nuevo Phone Number ID de 3145721407** (reemplaza el de prueba) |
| `WHATSAPP_CLOUD_TOKEN` | el token permanente de la Fase 3 |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | un texto secreto que inventes (ej. `as_wh_2026_x9k2`) |
| `WHATSAPP_APP_SECRET` | *(recomendado)* App Secret: developers.facebook.com → tu App → **Configuración → Básico → Clave secreta de la app** |
| `NOTIFICATIONS_WHATSAPP_ENABLED` | `true` (ya la tienes) |
| `WHATSAPP_TEMPLATE_PAYMENT`, `WHATSAPP_TEMPLATE_GENERIC`, `WHATSAPP_LANG` | ya las tienes |

Luego: **Deployments → ⋯ → Redeploy** (las variables solo aplican con un deploy nuevo).

---

## FASE 7 — Conectar el webhook (auto-respuesta)
1. Entra a **https://developers.facebook.com/apps/** → tu App.
2. Menú izquierdo → **WhatsApp → Configuración** (Configuration).
3. En **Webhook** → **Editar**:
   - **URL de devolución de llamada (Callback URL):**
     `https://arriendoseguro.app/api/whatsapp/webhook`
   - **Token de verificación:** el MISMO valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
   - Clic en **Verificar y guardar** (debe quedar en verde; si falla, revisa que ya
     hiciste el Redeploy con esa variable).
4. En **Campos del webhook (Webhook fields)** → **Administrar** → activa **`messages`**.

---

## FASE 8 — Poner la App en modo "Live"
1. En **developers.facebook.com/apps/** → tu App, arriba hay un interruptor
   **Desarrollo / En vivo (Development / Live)** → ponlo en **En vivo**.
2. Requiere tener correo de contacto y política de privacidad configurados
   (ya tienes `arriendoseguro.app/legal/...`).

---

## FASE 9 — Probar
1. **Auto-respuesta:** desde otro celular, escríbele por WhatsApp a **3145721407**.
   Debe llegarte: *"Este es un canal automático. Para atención escríbenos al
   304 474 5676."* (una vez por número cada 4 h).
2. **Alerta de pago:** crea un contrato de prueba (tu correo + tu celular como
   inquilino), fírmalo, y en **Administra → Pagos** pon la fecha de vencimiento = HOY.
   Luego dispara el cron (reemplaza el secreto real):

   ```bash
   curl -i -X POST "https://arriendoseguro.app/api/payments/tenant-reminders/send-due" -H "Authorization: Bearer TU_CRON_SECRET"
   ```

   Debe responder `{"success":true,"reminders":1,...}` y llegarte correo + WhatsApp.

---

## Diagnóstico (colecciones en Firestore)
- **`whatsapp_logs`**: cada envío con `status` (`sent` / `failed` / `mock`) y
  `errorMessage` de Meta.
  - `templateCode: "paymentReminderWa"` → alertas de pago/mora.
  - `templateCode: "autoReplyText"` → auto-respuestas del webhook.
- **`whatsapp_autoreply`**: sello anti-spam por número (última auto-respuesta).

**Errores comunes de Meta:**
- `mock` en el log → falta `NOTIFICATIONS_WHATSAPP_ENABLED=true` o faltan credenciales.
- `Meta 131030` / recipient not in allowed list → sigues en número de PRUEBA; pasa al real.
- `Meta 132xxx` (template) → nombre/idioma de plantilla no coincide con la variable.
- `Meta 190` / token expired → el token no es permanente (rehacer Fase 3).
- Webhook no verifica → falta el Redeploy con `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

---

## Resumen de "quién hace qué"
- **Tú, en Meta:** Fases 1–5, 7 (webhook config), 8. Y la tarjeta (Fase 4).
- **Variables en Vercel + Redeploy:** Fase 6 (tú también, pero te acompaño).
- **Código:** ya está desplegado (webhook, envío de texto, cadena de plantillas).
