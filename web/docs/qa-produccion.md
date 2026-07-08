# QA — Aplicación en producción (arriendoseguro.app)

Checklist de pruebas del **flujo completo real** (rama `main`). Marca ✅ pasa / ❌ falla (con navegador/dispositivo, pasos, esperado vs obtenido y captura).

## ⚠️ Antes de empezar — importante
- **Los pagos son REALES.** Wompi está en producción: cada pago del Plan Plus **cobra dinero de verdad** (~$49.900). Para probar las funciones Plus **sin pagar**, usa el botón interno **`/admin` → "Activar Plan Plus de prueba"** (solo cuentas internas). Haz **una** prueba de pago real por aparte y de forma controlada.
- Usa **cuentas de prueba** propias (arrendador, y un correo/celular distinto para el inquilino/codeudor).
- Revisa que los **correos** lleguen (y no a spam): usa direcciones reales que puedas abrir.
- Cuentas internas (para ver `/admin` y los botones internos): las definidas en `ADMIN_INTERNAL_EMAILS`.

---

## 1. Público / marketing y navegación
- [ ] **Home** (`/`) carga; menú y accesos funcionan.
- [ ] **Blog** (`/blog` y un artículo): se ve el contenido; los **botones de volver/inicio** funcionan.
- [ ] **Entiéndelo fácil**, **Acerca de**, **Contacto**, **Reportar**, **Estado**: cargan y tienen botón de volver.
- [ ] **Calculadoras**: canon máximo (Ley 820), reajuste de canon (IPC), preaviso, garantía de servicios — dan resultados coherentes; botón "Volver a calculadoras".
- [ ] **Plantillas** (índice y una plantilla): se ven/descargan.
- [ ] **Legales** (términos, privacidad, cookies, firma electrónica, etc.): abren y citan normas reales.
- [ ] **Anuncios internos** (house ads) aparecen en blog/entiéndelo fácil (rotan); **no** aparecen dentro del panel (`/dashboard`).
- [ ] **Móvil**: todo responsive, sin desbordes horizontales.

## 2. Cuenta y consentimiento
- [ ] **Crear cuenta** (`/crear-cuenta`) y **Ingresar** (`/ingresar`) funcionan.
- [ ] Primer uso pide **consentimiento de datos (Habeas Data)** antes de crear contrato.
- [ ] **Cerrar sesión** funciona.

## 3. Crear contrato — expediente (el núcleo)
- [ ] **Nuevo contrato** → arranca el asistente.
- [ ] **Datos del arrendador**: valida nombre (mín. 5, sin números), documento por tipo (CC/CE/NIT con dígito de verificación/Pasaporte), **teléfono de 10 dígitos**, correo válido.
- [ ] **Calidad**: dueño vs **apoderado** — si es apoderado, exige subir el **poder** y una declaración específica.
- [ ] **Inmueble**: dirección, ciudad, matrícula, tipo; **tope legal del canon (1% del valor comercial, Ley 820)** — si el canon supera el tope, **bloquea**; opción "no conozco el valor comercial" exige aceptación expresa.
- [ ] **Juramento del inmueble** obligatorio para avanzar.
- [ ] **Inquilino** y **codeudor** (opcional): mismas validaciones de persona.
- [ ] **Servicios públicos** y **cláusulas especiales**: catálogo sin costo; **"Otra"** muestra el **cobro adicional** ($50.000) y avisa que se suma al Plan Plus.
- [ ] **Datos inválidos o en blanco NO dejan avanzar** en ningún paso.

## 4. Invitaciones a la otra parte
- [ ] El dueño puede **llenar** los datos del inquilino/codeudor **o enviar invitación** por enlace.
- [ ] Si **cambia el correo** del invitado, el enlace nuevo va al **correo correcto** (no al anterior).
- [ ] El invitado abre `/invitacion/{token}`, **verifica por OTP**, ingresa **sus** datos y acepta **sus** juramentos/autorización (el dueño no acepta por él).
- [ ] Enlace **expirado/ya usado** se maneja con mensaje claro.

## 5. Vista previa y PDF (tier gratis vs Plus)
- [ ] **Vista previa** muestra el contrato completo con los datos ingresados.
- [ ] **Gratis**: genera/descarga PDF **con marca de agua** «arriendoseguro.app».
- [ ] **Plan Plus/demo**: PDF **limpio** (sin marca).
- [ ] Si el **tier gratis está apagado** en `/admin`, crear un contrato **exige Plan Plus**.

## 6. Plan Plus / Pagos (💰 dinero real)
- [ ] `/dashboard/plans` muestra el **precio vigente** ($49.900) y el **mensaje promocional** ("Promoción de lanzamiento…").
- [ ] **Activar Plan Plus** → abre el **checkout de Wompi**; al pagar y volver, queda **"Plan Plus activo: Sí"**.
- [ ] **Con cláusula «Otra»**: el carrito suma **$99.900** ($49.900 + $50.000) y cobra el total.
- [ ] **Webhook**: tras pagar, se activa el acceso Plus y llega el **correo de confirmación** (revisar `/admin` → observabilidad o logs si falla).
- [ ] **Descuento por referido** (si aplica) se refleja en el precio.
- [ ] **(Interno)** "Activar Plan Plus de prueba" en `/admin` otorga Plus sin pagar (para probar lo demás).

## 7. Firma electrónica (Plus)
- [ ] Con Plus, **Iniciar firma**: llega la **solicitud por correo** a cada parte (dueño, inquilino, codeudores) al correo **correcto**.
- [ ] Cada parte firma en `/firma/{token}` con **OTP** y queda **evidencia** (fecha/IP/hash, Ley 527).
- [ ] **No se duplican** firmas (una por parte).
- [ ] Estado "**ya firmado**" cuando corresponde; cuando **todos** firman, el contrato queda firmado.

## 8. Inventario y acta (Plus)
- [ ] **Inventario guiado** con **fotos** por ambiente.
- [ ] **Acta de entrega** se genera y queda disponible para ambas partes.

## 9. Pagos del arriendo / recordatorios (Plus)
- [ ] **Calendario de pagos** se genera desde "Pagos y recordatorios" (configuración única).
- [ ] Los **recordatorios al inquilino** salen los días configurados (N días antes + el día del vencimiento) — ver `/dashboard/.../pagos-recordatorios`.
- [ ] El inquilino recibe el **enlace mágico** (`/pago/{token}`), ve el **método de pago (QR/cuenta)** y **sube el soporte**.
- [ ] El dueño **confirma** el pago; si no confirma en 3 días, **escala** a ambas partes.

## 10. Renovación y alertas
- [ ] **Renovar contrato** crea un expediente nuevo partiendo del anterior.
- [ ] Recordatorios de **renovación** e **IPC** (reajuste) se envían cuando corresponde.

## 11. Reputación
- [ ] **Consulta de reputación** exige **consentimiento (Habeas Data)** antes de mostrar.
- [ ] **Evaluar** a la contraparte (privado y estructurado) funciona.

## 12. Gestionar arriendos / evidencia
- [ ] `/dashboard/leases` lista los contratos con **estado**.
- [ ] **Calificación** y **exportables/evidence bundle** se generan.

## 13. Admin (`/admin`, solo cuentas internas)
- [ ] **Precio Plan Plus / promociones**: cambiar entre sin promoción / precio fijo / % de descuento, con **nombre y mensaje**; se refleja en Planes.
- [ ] **Tier gratis**: activar/apagar + etiqueta + mensaje; apagarlo obliga a Plus para crear.
- [ ] **Anuncios**: modo house/AdSense/off + IDs de unidad.
- [ ] **Hub de pagos**: registrar/activar/desactivar apps (credenciales una sola vez).
- [ ] **Legal**: IPC del año, **precio de la cláusula "Otra"**, correo del **aliado jurídico**.
- [ ] **Referidos**, **observabilidad**, **exportar encuestas (CSV)**.

## 14. Correos (entregabilidad)
- [ ] Todos los correos (invitación, firma, confirmación Plus, recordatorios, escalamiento) **llegan** y **no caen en spam**.
- [ ] En "Mostrar original" (Gmail) → **SPF, DKIM, DMARC = PASS**.
- [ ] El remitente sale como **ArriendoSeguro** desde `no-reply@arriendoseguro.app`.

## 15. Accesibilidad y lectura por voz
- [ ] La función de **lectura por voz** (accesibilidad) lee los bloques de texto/contrato, con pausa/continuar/velocidad.
- [ ] Navegación por **teclado** y con **lector de pantalla** en las páginas clave.

## 16. Seguridad / permisos (verificación de que NO pasa lo que no debe)
- [ ] Un usuario **sin sesión** no puede acceder al panel ni a datos de otros.
- [ ] Un usuario normal **no** ve `/admin` ni los botones internos.
- [ ] No se puede **firmar/generar sin Plus** cuando el tier gratis lo exige.

## 17. Cron / tareas programadas
- [ ] El **cron diario** (`/api/cron/daily`) corre 1 vez al día (ver logs de Vercel: 200) y dispara recordatorios de pago, renovación e IPC.

---

**Prioridad de reporte:** primero **§6 Pagos** y **§7 Firma** (dinero y validez legal), luego **§3–5** (creación/validación) y **§4 invitaciones/OTP**. Cada ❌ con pasos reproducibles y captura.

> Nota: el rediseño de interfaz "Un paso a la vez" está en la rama `rediseno-frontend-v2` (preview), con su propio checklist en `web/docs/qa-nuevo.md`. Este documento es para la **app en producción** (`main`).
