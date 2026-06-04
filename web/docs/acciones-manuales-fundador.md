# Acciones manuales del fundador — ArriendoSeguro

> **Qué es esto:** la lista de tareas que **solo tú puedes hacer** (requieren tus cuentas y
> credenciales) para activar en producción lo que ya quedó listo en el código. El agente no puede
> hacerlas por ti porque necesitan acceso a Firebase, Vercel, Google y tu dominio.
>
> **Nombre del archivo:** `web/docs/acciones-manuales-fundador.md`
> **Última actualización:** 2026-06-03.

Marca cada casilla a medida que avances. Orden recomendado de arriba hacia abajo.

---

## 1. Desplegar las reglas de seguridad de Firebase ⚠️ (lo más importante)

Hoy el código trae reglas que **bloquean todo acceso directo del cliente** a Firestore y Storage
(es seguro porque la app solo accede desde el servidor con Admin SDK). Falta **publicarlas**.

- [ ] Instala Firebase CLI si no la tienes: `npm install -g firebase-tools`
- [ ] Inicia sesión: `firebase login`
- [ ] Selecciona el proyecto correcto: `firebase use --add` (elige el proyecto de ArriendoSeguro)
- [ ] Despliega las reglas:
  ```bash
  cd web
  firebase deploy --only firestore:rules,storage:rules
  ```
- [ ] Verifica en la consola de Firebase → **Firestore → Reglas** y **Storage → Reglas** que el
      contenido coincide con `web/firestore.rules` y `web/storage.rules`.
- [ ] Prueba la app en producción: crear contrato, firmar, subir soporte. Todo debe seguir
      funcionando (usa el servidor, no el cliente). Si algo falla, avísale al agente **antes** de
      revertir.

> Si habilitaste Storage por primera vez, confirma que el bucket existe (Firebase → Storage →
> Comenzar) y que `FIREBASE_STORAGE_BUCKET` está configurada (ver paso 2).

---

## 2. Variables de entorno en Vercel

Entra a **Vercel → Proyecto ArriendoSeguro → Settings → Environment Variables** (entorno
**Production**, y también Preview si quieres probar). Agrega o confirma:

- [ ] `NEXT_PUBLIC_APP_URL` = `https://arriendoseguro.app`
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` = (JSON de la cuenta de servicio, ya debería estar)
- [ ] `FIREBASE_STORAGE_BUCKET` = `tu-proyecto.firebasestorage.app` (el bucket real)
- [ ] `CONTACT_INBOX_EMAIL` = el correo donde quieres recibir los mensajes del formulario `/contacto`
- [ ] `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (ver paso 3)
- [ ] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (ver paso 5)
- [ ] `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXX` (si vas a usar Google Analytics)
- [ ] `ADMIN_INTERNAL_EMAILS` = `clpezci@gmail.com,clopezci@hotmail.com` — **necesario** para que tú (y solo tú) entres a `/admin` y veas las pestañas **Reportes** y **Errores** (la alternativa propia a Sentry). El servidor valida con esta lista; nunca con el navegador.
- [ ] (Opcional) `ADMIN_INTERNAL_ENABLED=true` para habilitar "Otorgar Plus" manual desde el panel.

> Tras cambiar variables, **vuelve a desplegar** (Vercel → Deployments → Redeploy) para que tomen
> efecto, porque las `NEXT_PUBLIC_*` se inyectan en build.

---

## 3. Rate-limit con Upstash Redis (anti-abuso)

El código ya limita `/api/leads`, `/api/contact` y el envío de OTP de firma. En local usa memoria;
en producción conviene Upstash (lo elegiste). Ya pagas Vercel/Supabase, pero Upstash tiene capa
gratuita suficiente para empezar.

- [ ] Crea una base en **https://upstash.com** (o desde Vercel → Storage → KV/Upstash).
- [ ] Copia `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Pégalas en las variables de Vercel (paso 2) y redepliega.
- [ ] (Opcional) Verifica que al recargar muchas veces la encuesta, a partir de cierto número
      responde "Demasiadas solicitudes".

---

## 4. Resend: verificar el dominio de correo

Para que salgan los correos (encuesta, contacto, OTP de firma, confirmaciones) sin caer en spam.

- [ ] En **https://resend.com** → Domains → agrega `arriendoseguro.app`.
- [ ] Crea en tu proveedor de DNS los registros que Resend indique (SPF, DKIM, y DMARC recomendado).
- [ ] Espera la verificación (puede tardar minutos/horas).
- [ ] Confirma en Vercel: `RESEND_API_KEY` y `EMAIL_FROM` = `ArriendoSeguro <no-reply@arriendoseguro.app>`.
- [ ] (Recomendado) Crea un buzón real `hola@arriendoseguro.app` o `contacto@arriendoseguro.app`
      y úsalo en `CONTACT_INBOX_EMAIL`.

---

## 5. Google Search Console (SEO)

- [ ] Entra a **https://search.google.com/search-console**.
- [ ] Agrega la propiedad `https://arriendoseguro.app`.
- [ ] Elige el método **Etiqueta HTML**; copia **solo el valor** del atributo `content`
      (algo como `abcd1234...`), NO toda la etiqueta.
- [ ] Pégalo en Vercel como `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` y redepliega.
- [ ] Vuelve a Search Console y pulsa **Verificar**.
- [ ] Una vez verificado, ve a **Sitemaps** y envía: `https://arriendoseguro.app/sitemap.xml`.

---

## 6. Google AdSense (cuando el sitio tenga más contenido)

Antes de aplicar conviene tener el blog ampliado (lo está preparando el agente) y los pasos
anteriores listos. Requisitos clave que **ya cubrimos** en el sitio: páginas Acerca de y Contacto,
banner de consentimiento de cookies, política de privacidad y de cookies.

- [ ] Crea cuenta en **https://adsense.google.com** con el dominio `arriendoseguro.app`.
- [ ] Agrega el código de AdSense cuando el agente prepare la integración (irá **solo en páginas
      públicas**: blog/landing, nunca dentro del panel con datos personales).
- [ ] Espera la revisión de Google (suele tardar días).

> No coloques anuncios manualmente dentro del panel ni en pantallas con datos personales: viola
> las políticas de AdSense. Coordina con el agente la integración.

---

## 7. Formalización (opcional, para cobrar y dar confianza)

- [ ] Lee la guía `web/docs/guia-camara-comercio-virtual.md` (RUT + Cámara de Comercio virtual).
- [ ] Cuando tengas razón social/NIT, avísale al agente para actualizar `/acerca-de` y los legales.

---

## 7b. SMS y recordatorios automáticos (posventa)

El código ya envía **recordatorios de vencimiento** (terminación/renovación) y avisos de **novedades/daños** por correo y SMS. Para activarlos en producción:

- [ ] **SMS** (opcional, tiene costo): crea cuenta en un proveedor (hoy soportado: **Twilio**) y define en Vercel `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (y `SMS_PROVIDER=twilio`). Sin esto, los SMS quedan en **modo mock** (no se envían, no cobran) y los correos sí salen. *Si prefieres un proveedor colombiano, dímelo y agrego esa rama.*
- [ ] **CRON_SECRET**: define un valor en Vercel y úsalo al programar el cron.
- [ ] **Programar el cron diario** que dispara los recordatorios de vencimiento:
      `POST https://arriendoseguro.app/api/contracts/renewal-reminders/send-due`
      con header `Authorization: Bearer <CRON_SECRET>`. Opciones: **Vercel Cron** (añadir `crons` en `vercel.json`), GitHub Actions, o un servicio externo (cron-job.org). Recomendado: 1 vez al día.
- [ ] (Ya existía) recordatorios de **pago**: `POST /api/payments/reminders/send-due` (mismo esquema de cron).
- [ ] **Recordatorio anual del IPC** (nuevo): `POST https://arriendoseguro.app/api/legal/ipc-reminder/send-due` con header `Authorization: Bearer <CRON_SECRET>`. Prográmalo **1 vez al día** (mismo esquema que los demás crons). El endpoint solo envía correo a tus correos de admin (`ADMIN_INTERNAL_EMAILS`) **a partir de la segunda semana de enero** (día ≥ 8) si todavía no confirmaste el IPC del año, y como máximo una vez cada 7 días. **Deja de enviarte el correo en cuanto entras a `/admin` → tarjeta "IPC para reajuste del canon" y pulsas "Guardar y marcar actualizado" o "Ya está vigente (confirmar)".**

### Valores que ahora administras tú desde `/admin` (sin tocar código)
- **IPC para reajuste del canon (Ley 820):** porcentaje del año anterior y año al que aplica. El algoritmo de la calculadora de reajuste lee este valor. Actualízalo cada enero (o si la ley cambia) cuando el DANE publique el IPC.
- **Precio del Plan Plus:** elige preset (promo $49.900 / lista $89.900) o **"Otro"** con dos campos: **precio vigente (checkout)** y **precio de lista (tachado)** para mostrar el descuento. El precio de lista debe ser ≥ al vigente; si lo dejas vacío se usa el de lista por defecto.

## 7c. Firma electrónica con proveedor (Firma.dev) — próximo bloque

Hoy la firma es electrónica **simple** (token + OTP por correo + evidencia, Ley 527). Para escalar a una firma con mayor respaldo se evaluará **Firma.dev** (opción asequible para empezar, con posibilidad de escalar; si cubre el crecimiento, queda como definitivo).

- [ ] Crear cuenta en **Firma.dev** y obtener credenciales/API key (sandbox y producción).
- [ ] Definir plan/costo y límites de firmas según el volumen esperado.
- [ ] Compartir al agente las llaves para integrarlas (irán como variables de entorno en Vercel, **nunca** en el código).
- [ ] (El agente) dejará la integración **detrás de una abstracción** para poder cambiar de proveedor a futuro sin reescribir el flujo de firma.

## 8. Pagos (Wompi) — más adelante

Queda de último. Vas a integrar tu **hub de pagos portátil** (ya funcional en otra app).

- [ ] Comparte al agente el hub portátil completo + su documentación de integración.
- [ ] Reúne las llaves de Wompi: `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`,
      `WOMPI_INTEGRITY_SECRET`, `WOMPI_ENVIRONMENT`.

---

## Resumen ultra-corto (si tienes 10 minutos hoy)

1. `firebase deploy --only firestore:rules,storage:rules` (paso 1).
2. En Vercel: `NEXT_PUBLIC_APP_URL`, `CONTACT_INBOX_EMAIL` y redeploy (paso 2).
3. Search Console: verificar + enviar sitemap (paso 5).

El resto puede esperar a tener tiempo. Lo de Wompi, al final.
