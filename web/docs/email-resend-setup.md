# Configuración del proveedor de correo (Resend)

Este documento explica **paso a paso** cómo dejar el envío de correos
real en ArriendoSeguro. Mientras no exista la configuración, la
aplicación usa un proveedor "mock": las firmas y demás flujos sí se
guardan en Firestore, pero **no se envía ningún correo electrónico
real**. La UI muestra un aviso amarillo en la pantalla de firma cuando
esto ocurre, para que ninguna persona piense que su contraparte ya
recibió la invitación.

## 1. ¿Qué provee Resend?

Resend es un servicio de envío transaccional de correos. Para esta
fase usamos su capa gratuita: hasta 3.000 correos al mes y 100 correos
diarios, suficiente para validar firmas, novedades y notificaciones de
soporte.

## 2. Crear la cuenta y la API key

1. Entra a [https://resend.com](https://resend.com) y crea una cuenta
   con `arriendoseguro0@gmail.com` (o el correo que el equipo decida).
2. En el panel, abre **API Keys → Create API Key**.
3. Asígnale el nombre `arriendoseguro-vercel` y permisos
   `Sending access`.
4. Copia el valor que comienza por `re_…`. **Solo se ve una vez.** Si
   se pierde, hay que generar otra.

## 3. ¿Qué dirección uso como remitente mientras no tenemos dominio?

Resend exige que el remitente venga de un dominio verificado. Mientras
no tengamos `@arriendoseguro.app` (u otro dominio propio) listo, hay
dos opciones:

- **Recomendada para pruebas reales:** verificar el dominio actual del
  proyecto (`arriendoseguro.app` cuando esté listo en Vercel) siguiendo
  los DNS que Resend pide. Tarda pocos minutos.
- **Mientras tanto, para QA interno:** Resend permite remitente
  `onboarding@resend.dev`. Los correos llegan, pero a veces caen a
  spam. Útil solo para validar el flujo internamente.

Cuando tengamos dominio propio en producción, cambiamos
`EMAIL_FROM` para que use `no-reply@arriendoseguro.app` (o el alias
que decidamos).

## 4. Variables de entorno

En Vercel (Settings → Environment Variables) agrega:

| Variable | Valor sugerido | Comentario |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_…` (la API key del paso 2) | Sin esta variable, todos los correos se quedan en modo mock. |
| `EMAIL_FROM` | `ArriendoSeguro <onboarding@resend.dev>` o `ArriendoSeguro <no-reply@arriendoseguro.app>` cuando el dominio esté verificado. | Debe ir en formato `Nombre legible <correo>`. |

Agrega ambos para los entornos **Production** y **Preview**.

Después de guardar, redeploya el proyecto desde el panel de Vercel
(menú "..." → Redeploy → with cache cleared no es necesario).

## 5. Probar que funciona

1. Entra a `https://<tu-dominio-vercel>/dashboard/contracts/<id>/preview`.
2. Termina el contrato hasta llegar a "Iniciar firma".
3. Al hacer clic en "Iniciar firma":
   - Si Resend está configurado, verás un banner verde con la lista
     de correos enviados.
   - Si no, verás un banner amarillo indicando que el envío real está
     pendiente y la ronda quedó registrada solo a efectos demo.
4. Revisa la bandeja del correo destinatario. Si no aparece, mira la
   pestaña **Logs** de Resend para ver el detalle de la entrega.

## 6. Logs y monitoreo

- Los intentos de envío quedan en la colección `email_logs` de
  Firestore con `status: "sent" | "mock" | "failed"`.
- Cualquier error (clave inválida, dominio no verificado, etc.) se
  registra en `email_logs.errorMessage` y se emite el evento de
  auditoría `signature_email_failed`.

## 7. Próximos pasos

- Cuando el dominio `arriendoseguro.app` esté verificado, cambiar
  `EMAIL_FROM` en producción.
- Si la versión gratuita queda corta, evaluar `Resend Pro` o un
  proveedor alternativo (SendGrid / Mailgun). El módulo `sendEmail`
  abstrae el proveedor, así que cambiar de servicio implica solo crear
  una nueva clase `EmailProvider`.
