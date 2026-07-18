# Pendientes manuales (consolidado actual) — qué, cómo y dónde

Todo el código está desplegado en producción. Lo de abajo son tareas de
**configuración, legal o de cuentas externas** que solo tú puedes hacer.
(El pendiente histórico de calidad ISO/2FA está en `docs/PENDIENTES-USUARIO.md`.)

---

## 1) WhatsApp — terminar de activarlo
**Dónde:** Meta (business.facebook.com / developers.facebook.com) y Vercel. Guía: `docs/WHATSAPP-SETUP.md`.

- [ ] **Phone Number ID:** developers.facebook.com → tu App → WhatsApp → API Setup → "Identificador del número de teléfono".
- [ ] **Token permanente:** ya lo generaste (System User "Notificaciones").
- [ ] **Crea la plantilla neutra `aviso_general`** (Utility, idioma **es_CO**, `{{1}}` en el medio):
      `Hola, tienes una novedad de tu arriendo en ArriendoSeguro: {{1}} Ingresa a la plataforma para verla.`
- [ ] **Variables en Vercel** (Settings → Environment Variables):
      ```
      NOTIFICATIONS_WHATSAPP_ENABLED = true
      WHATSAPP_CLOUD_TOKEN           = (token permanente)
      WHATSAPP_PHONE_NUMBER_ID       = (Phone Number ID)
      WHATSAPP_LANG                  = es_CO
      WHATSAPP_TEMPLATE_PAYMENT      = recordatorio_pago
      WHATSAPP_TEMPLATE_GENERIC      = aviso_general
      ```
- [ ] **Destinatarios de prueba:** API Setup → "Para/To" → agrega tu celular (máx. 5).
- [ ] **Producción (enviar a cualquiera):** Paso 2 (número real + método de pago) y Paso 3 (verificación del negocio).

## 2) Bre-B — habilitar cobro
**Dónde:** tu banco/billetera y Vercel. Guía: `docs/BREB-SETUP.md`.

- [ ] **Registra tu llave Bre-B** (cédula, celular, correo o @llave) en tu banco/Nequi.
- [ ] **Modo interno (rápido):** en Vercel `BREB_LLAVE` + `NEXT_PUBLIC_BREB_ENABLED=true`.
- [ ] **Automático (API):** revisa si **Wompi** ya ofrece Bre-B como método (lo más simple). Si no,
      consigue un proveedor Bre-B con API, pon `BREB_API_BASE_URL/BREB_API_KEY/BREB_WEBHOOK_SECRET`,
      registra el webhook `.../api/platform-payments/breb-webhook`, y pásame su documentación.

## 3) Reputación — visto bueno legal antes de publicar el directorio
**Dónde:** abogado + SIC + Vercel. Guía: `docs/REPUTACION-DIRECTORIO.md`.

- [ ] **Sign-off del abogado** (Habeas Data) para el módulo de reputación.
- [ ] **Directorio entre usuarios:** evaluar **Ley 1266/2008**, **registrar la base en el RNBD** de la SIC, y solo
      entonces poner `NEXT_PUBLIC_REPUTATION_DIRECTORY_ENABLED=true` en Vercel.
- [ ] Cuando el abogado apruebe, **avísame para quitar la nota "borrador"** de la cláusula de pago.

## 4) Cláusula «Otra» / aliado jurídico
**Dónde:** `/admin`.
- [ ] **Configura el correo del aliado jurídico** (legalPartnerEmails) para que las cláusulas «Otra» le lleguen
      (hoy el correo se envía SOLO al pagarse la cláusula).

## 5) Aliados (cobranza, jurídica, seguros…)
**Dónde:** `/admin`.
- [ ] **Da de alta los aliados** reales para que aparezcan las tarjetas contextuales y el handoff funcione.

## 6) Google Sign-in
**Dónde:** consola de Firebase → Authentication.
- [ ] **Habilita el proveedor Google** (Sign-in method) y agrega el dominio en **Authorized domains**.

## 7) Hub de pagos para otras apps
**Dónde:** `/admin` (hub-apps). Guía para el otro dev: `docs/HUB-INTEGRATION.md`.
- [ ] **Registra cada app externa** (te entrega apiKey + hmacSecret).

## 8) IA de validación antifraude de documentos
**Ya funciona** (lee PDF/Word/foto; valida tipo + nombre/número; alerta roja no bloqueante).
- [ ] **Requiere `AI_API_KEY`** (Groq) en el entorno. Sin ella, muestra "revisión manual".
- [ ] (Opcional) OCR de PDF escaneados: avísame si lo quieres.

---

## Cómo probar de extremo a extremo (checklist)
1. **/nuevo:** crea un contrato. Prueba que **inquilino y codeudor con el mismo documento** te **bloquee**.
2. **Documento de propiedad** (PDF/foto): revisa la alerta de **nombre + dirección**.
3. **Soportes** del inquilino/codeudor: pulsa **"Verificar"** en cada uno (cédula, extracto, carta…) y mira el badge.
4. **Planes:** prueba el pago (Wompi; y "Pagar con Bre-B" si lo activaste).
5. **WhatsApp** (con tu celular como destinatario de prueba): dispara y confirma un recordatorio de pago.

> No soy asesor legal ni financiero; los puntos legales requieren tu abogado y las tarifas/condiciones, la confirmación de cada proveedor.
