# Plan de mejoras — Contrato + Flujo (2026)

> Documento operativo para coordinar los siguientes cambios sin romper la
> versión activa (`AS-LEASE-MVP-2026.1`). Toda implementación nueva entra
> bajo nueva versión `AS-LEASE-2026.2` y se activa con un flag/sw cuando esté
> probada. Última revisión: 2026-05-11.

---

## 1. Principios

1. **No romper lo existente.** El contrato actual y el wizard siguen vivos
   hasta que la nueva versión esté validada por el abogado y probada en
   demo.
2. **Mobile-first + PWA** en cada pantalla nueva o ajustada.
3. **Cumplimiento legal Colombia:** Ley 820/2003 (arriendo vivienda urbana),
   Ley 527/1999 (firma y mensaje de datos), Ley 1581/2012 (tratamiento de
   datos), CGP y Cód. Civil.
4. **Compatibilidad con expedientes ya creados:** mantener
   `AS-LEASE-MVP-2026.1` operativo en modo lectura.
5. **Continuidad del flujo:** todo lo que aún no está disponible se muestra
   pero no bloquea (botón en gris + mensaje *“próximamente”*).
6. **Trazabilidad documental:** cualquier acción crítica deja registro en
   `audit_logs` y/o en el expediente.

---

## 2. Estado actual (resumen)

- **Contrato** versión `AS-LEASE-MVP-2026.1`:
  - Cláusulas de objeto, destinación, canon, duración, reajuste,
    forma de pago, servicios públicos, entrega, obligaciones,
    prohibición de depósitos, firma electrónica, tratamiento de datos,
    evaluación estructurada, notificaciones, mora/terminación/restitución,
    anexos, plataforma, aceptación.
  - Bloques condicionales: codeudor (comparecencia, cláusula,
    notificación, firma).
- **Wizard** (`web/src/app/dashboard/contracts/[id]/*`):
  1. Acceso (demo / plus / pending).
  2. Arrendador.
  3. Arrendatario.
  4. Codeudor (opcional).
  5. Inmueble.
  6. Términos.
  7. Servicios.
  8. Resumen.
  9. Vista previa.
- **Firma**: token único por firmante, `signatureEvidence` con
  `ipAddress`, `userAgent`, `documentHash`, `signedAt`, `consentTexts`,
  `signatureMethod`. Falta OTP por email.
- **Evidencia digital**: contrato firmado en PDF + anexo de firma;
  bitácora de pagos en PDF; inventario; acta de entrega.
- **Consentimiento de datos**: cláusula en contrato y página
  `/legal/aviso-privacidad`. Falta consentimiento explícito en
  registro/creación de cuenta y en inicio del wizard.

---

## 3. Lo que pediste — mapeado a tareas

### A. Cláusulas nuevas en el contrato (nueva versión `AS-LEASE-2026.2`)

- A1. **Obligación clara de pago** (canon, día, método).  
  → Ya cubierta parcialmente en la cláusula TERCERA actual; reforzar
  con redacción explícita pedida.
- A2. **Cláusula de liquidación** en caso de mora (suma adeudada con
  base en canon, registros de pago y fechas de vencimiento).  
  → Nueva.
- A3. **Cláusula de codeudor reforzada**: firma expresa, obligación
  solidaria, notificación, autorización de datos, aceptación de
  prórrogas. (Aceptación de prórrogas queda condicionada a lo que
  confirme el abogado.)  
  → Mejora de la cláusula condicional actual.
- A4. **Cláusula de cláusulas especiales solicitadas por las partes**
  (placeholder dinámico que se llena si la persona marcó la casilla en
  el flujo). Aviso de que esos ajustes pueden tener costo adicional.  
  → Nueva, posición sugerida: justo antes de “Plataforma”.
- A5. **Cláusula de tipo de contrato** declarada explícitamente
  (vivienda urbana en esta versión).  
  → Nueva línea inicial.
- A6. **Cláusula de autenticación notarial** opcional (con leyenda de
  notariado digital próximo).  
  → Nueva.
- A7. **Reforzar firma electrónica con OTP**, IP, fecha/hora, user
  agent, hash, certificado de evidencia, versión inmutable del
  contrato.  
  → Texto ya tiene firma electrónica; se actualiza con lenguaje
  alineado a Ley 527 y al método “firma electrónica reforzada” descrito
  en el flujo nuevo.

> **No tocamos en esta versión** (decisiones del usuario hasta que el
> abogado confirme):
> - Depósito en dinero (mantener prohibición).
> - Todos los gastos del contrato a una sola parte (mantener neutral).
> - Autenticación notarial obligatoria (queda opcional).

### B. Firma electrónica reforzada (E2E)

- B1. **OTP por correo**:  
  - Envío de código de 6 dígitos al correo del firmante (gratis,
    usando nuestro proveedor de email actual `services/email/`).
  - Verificación server-side con TTL de 10 minutos, máximo 5 intentos.
  - Registro del éxito/fracaso en `audit_logs`.
- B2. **Evidencia ampliada**:  
  - Ya tenemos `ipAddress`, `userAgent`, `documentHash`, `signedAt`.
  - Agregamos: `otpVerifiedAt`, `otpEmail`, `consentBlockHash` (hash de
    los textos de consentimiento mostrados).
- B3. **Certificado de evidencia en PDF**:  
  - Documento independiente con todos los datos anteriores + sello
    de la plataforma + leyenda Ley 527/1999.
- B4. **Versión inmutable del contrato**:  
  - Snapshot del HTML al momento de iniciar la firma, guardado en
    `contract_versions` con su hash.
  - El PDF firmado se genera a partir de ese snapshot, no del draft
    actualizable.

### C. Anexo de evidencia (paquete final)

- C1. Carpeta lógica por expediente (`/contracts/{id}/evidencia/`) que
  agrupa:
  1. Contrato firmado (PDF).
  2. Anexo de firma electrónica (certificado de evidencia).
  3. Bitácora de pagos (PDF).
  4. Soportes de pago cargados.
  5. Estado de cuenta (vista agregada actual de pagos).
  6. Comunicaciones de mora (registro de eventos en audit logs).
- C2. UI: pestaña en el expediente *“Anexo de evidencia”* con descarga
  individual o bundle ZIP.

### D. Cambios en el flujo (wizard y módulos adyacentes)

- D1. **Selector de tipo de contrato** (Paso 1, antes de Arrendador):  
  - Opciones: *Vivienda urbana* (activa), *Vivienda rural*,
    *Arrendamiento de habitación*, *Inmueble comercial*, *Inmueble
    rural productivo*. Las inactivas en gris claro con tooltip
    *“próximamente disponible”*. Si la persona intenta seleccionarlas,
    aparece un toast/modal explicando que aún no está habilitado.
- D2. **Anotaciones especiales del expediente**:  
  - Campo `expedienteNotes` editable durante el wizard y desde el
    detalle del contrato. Se muestra en la UI siempre.
  - **No se imprime** en el PDF final del contrato.
  - Se guarda como parte del expediente con auditoría.
- D3. **Cláusulas especiales** (paso nuevo entre Servicios y Resumen):  
  - Checkbox *“¿Tienes cláusulas especiales para incluir?”*.
  - Si “Sí”: lista de comunes (mascotas, fumadores, parqueadero,
    teletrabajo, mobiliario, mantenimiento de zonas verdes,
    seguridad) + opción “Otra” con campo libre.
  - Aviso fijo: *“Estas cláusulas pueden tener un costo adicional que
    te será notificado antes de generar el contrato.”*
  - Quedan guardadas como datos estructurados; se imprimen en la
    cláusula nueva A4 del contrato.
- D4. **Autenticación notarial** (paso opcional al final, antes de
  firmar):  
  - Pregunta sí/no.
  - Si “Sí”:  
    - Mostrar el contrato listo para descargar con un aviso:
      *“Imprime, autentica en notaría y vuelve a cargarlo.”*  
    - Campo de carga de PDF/imagen autenticado.  
    - Mensaje: *“Próximamente: notariado digital con aliado
      estratégico.”*
  - Si “No”: continúa con firma electrónica reforzada normal.
- D5. **Estudio de crédito** (paso opcional en datos de
  arrendatario/codeudor):  
  - Checkbox *“Quiero hacer estudio de crédito a Arrendatario y/o
    Codeudor.”*
  - Si “Sí”:  
    - Mostrar link de aliado externo si está disponible.
    - Si no, mensaje *“Próximamente con aliado especializado; los
      costos dependerán del aliado.”*
  - No bloquea el flujo en ningún caso.
- D6. **Consentimiento de tratamiento de datos**:  
  - Modal/check al **crear cuenta** (registro).
  - Check explícito **al iniciar el wizard** del primer contrato.
  - Texto enlazado a `/legal/aviso-privacidad`.
  - Persistir en perfil del usuario con `acceptedAt`, `versionTexto`.

### E. Módulo de novedades del expediente

- E1. **Nueva pestaña** “Novedades y solicitudes” dentro del
  expediente.
- E2. **Formulario simple**:  
  - Lista desplegable: *Incumplimiento de pago*, *Daño en la
    propiedad*, *Falla de servicios*, *Ruido o convivencia*,
    *Solicitud de reparación*, *Solicitud de prórroga*, *Otra*.
  - Si “Otra” → campo de descripción.
  - Campo opcional de archivo (foto o documento).
- E3. **Acciones**:  
  - Envío automático de email a la contraparte (y al codeudor cuando
    aplique) usando `services/email/`.
  - Registro en `expediente.novedades` con timestamp, autor,
    destinatario, tipo, descripción, archivo.
  - Visible para todas las partes desde el expediente.
- E4. **Trazabilidad**:  
  - Cada novedad genera un evento en `audit_logs`.
  - Sirve como soporte en eventual conciliación/cobranza.

### F. Consentimientos y avisos legales (refuerzo)

- F1. Página `/legal/aviso-privacidad` ya existe → actualizar a
  **versión completa** (`AVISO-PRIV-2026.2`) que cubra:
  - Identificación del responsable (razón social ArriendoSeguro,
    NIT, dirección, correo de contacto, teléfono).
  - Finalidades del tratamiento por categoría: cuenta, contrato,
    firma, comunicaciones, evidencia digital, soporte y mejora del
    servicio.
  - Encargados actuales:
    - **Firebase / Google Cloud** (Auth, Firestore, Storage):
      hospedaje, autenticación, datos del expediente y archivos de
      soporte. Servidores en EE. UU.
    - **Vercel** (frontend y serverless): infraestructura sobre AWS
      en EE. UU. (us-east principalmente).
    - **Resend** (correos transaccionales): envío de correos sobre
      AWS en EE. UU.
    - **Cloudflare Turnstile** (anti-bot en formularios públicos):
      verificación humana, sin almacenamiento de PII.
    - *Reservado / a confirmar:* **Supabase** (Postgres / Storage /
      realtime) en caso de migración o doble proveedor — declarar
      sólo cuando se firme el acuerdo correspondiente.
  - **Transferencia internacional de datos** (Decreto 1377/2013,
    Circular SIC 02/2015): los proveedores anteriores procesan
    datos en EE. UU. ArriendoSeguro garantiza nivel de protección
    equivalente al de Colombia mediante cláusulas contractuales
    estándar y/o certificaciones del proveedor (Google Cloud:
    GDPR/ISO 27001/SOC 2; AWS: GDPR/ISO/SOC). El usuario otorga
    autorización expresa para esta transferencia al aceptar el
    consentimiento.
  - **Derechos Habeas Data** (Ley 1581/2012, art. 8): acceso,
    actualización, rectificación, supresión, revocatoria, conocer
    el uso, presentar quejas ante la SIC.
  - **Canales de ejercicio de derechos**:
    - Correo: `privacidad@arriendoseguro.com.co` (a configurar).
    - Formulario en la app: `/legal/solicitudes-habeas-data`.
    - Plazos: 10 días hábiles para consultas, 15 para reclamos
      (prorrogables 8 días según Ley 1581).
  - **Contacto para eliminación de cuenta**: instrucciones
    explícitas más enlace al formulario y/o botón en
    `/dashboard/cuenta/eliminar` (cuando se implemente Bloque 13).
  - **Conservación**: indicar plazos por tipo de dato (cuenta,
    contratos firmados, evidencia de firma, comunicaciones de
    cobranza). Justificación legal y comercial.
  - **Versión y vigencia**: identificador `AVISO-PRIV-2026.2`,
    fecha de publicación y bitácora de versiones anteriores.
- F2. Banner cookies/preferencias mínimo (opcional, baja prioridad).
- F3. En cada paso del wizard que recolecta datos sensibles
  (arrendatario, codeudor, estudio de crédito): mensaje breve con
  enlace al aviso.

---

## 4. Orden propuesto de implementación

Cada bloque se entrega como cambio independiente (commit/PR), probado
con `npm run build` y validado en Vercel, antes de pasar al siguiente.

1. **Bloque 1 — Tipos y borrador del nuevo contrato**  
   - Agregar `ContractVersion` `"AS-LEASE-2026.2"` (no activarla aún).
   - Crear borrador de `contractClauses-2026-2.ts` con todas las
     cláusulas nuevas y placeholders. Aún sin enganchar al wizard.
   - Documentar variables nuevas.
   - Sin cambios visibles en la UI.
2. **Bloque 2 — Consentimiento de datos (F1, F3, D6)**  
   - Check explícito en registro y en inicio del wizard.
   - Persistencia en perfil de usuario.
3. **Bloque 3 — Anotaciones especiales no imprimibles (D2)**  
   - Campo en wizard + detalle, no entra al PDF.
4. **Bloque 4 — Tipo de contrato (D1)**  
   - Paso 1 con tarjetas; demás opciones inactivas con aviso.
5. **Bloque 5 — Cláusulas especiales (D3 + A4)**  
   - Paso nuevo entre Servicios y Resumen.
   - Imprime en la cláusula condicional A4.
   - Mensaje de costo adicional.
6. **Bloque 6 — Estudio de crédito (D5)**  
   - Sub-paso opcional con link/mensaje aliado.
7. **Bloque 7 — Firma electrónica reforzada (B1 → B4)**  
   - OTP por email.
   - Evidencia ampliada.
   - Snapshot inmutable.
   - Certificado de evidencia en PDF.
8. **Bloque 8 — Anexo de evidencia (C1, C2)**  
   - Pestaña con bundle de documentos.
9. **Bloque 9 — Notariado opcional (D4 + A6)**  
   - Paso opcional + campo de carga + leyenda aliado.
10. **Bloque 10 — Módulo de novedades (E1 → E4)**  
    - Nueva pestaña + email + audit logs.
11. **Bloque 11 — Switch oficial a `AS-LEASE-2026.2`**  
    - Flag para nuevos expedientes una vez el abogado confirme la
      versión 2026.2 final.
    - `AS-LEASE-MVP-2026.1` queda en modo lectura para expedientes
      antiguos.
12. **Bloque 12 — Carga segura de soportes del codeudor (Firebase Storage)**  
    - Habilitar Firebase Storage en el proyecto y crear el bucket por
      defecto si aún no existe (consola Firebase → Storage → *Get
      started*).
    - Estructura de rutas: `gs://{bucket}/contracts/{contractId}/codebtor-supports/{supportType}/{timestamp}-{filename}`.
    - **Tipos permitidos:** `application/pdf`, `image/jpeg`, `image/png`.
    - **Tamaño máximo:** 10 MB por archivo, hasta 5 archivos por tipo
      de soporte (carta laboral, colilla, certificado de libertad y
      tradición, extracto, declaración de renta, otro).
    - **Reglas de seguridad** (`storage.rules`): solo el creador del
      expediente (uid del arrendador) puede subir; arrendador,
      arrendatario y codeudor del expediente pueden listar/leer; nadie
      puede sobrescribir un archivo existente; lectura pública prohibida.
    - Endpoint server: `POST /api/codebtor-supports/upload-url` que
      devuelve URL firmada de subida (Admin SDK). El cliente sube
      directo a Storage; al terminar llama a `POST
      /api/codebtor-supports/confirm` que persiste el metadato en el
      draft (`solidaryCoDebtor.economicSupport.uploads[]` con
      `storagePath`, `mimeType`, `sizeBytes`, `uploadedAt`,
      `uploadedBy`).
    - UI: dentro del bloque “Respaldo económico del codeudor” permitir
      arrastrar/seleccionar archivos por tipo. Mostrar lista de los ya
      cargados con badge del tipo y botón “Eliminar” (que invalida
      metadato y dispara borrado en Storage vía API).
    - Descarga: `GET /api/codebtor-supports/download-url?path=...`
      verifica permisos del solicitante y devuelve URL firmada con TTL
      15 minutos.
    - Auditoría: `audit_logs` para `codebtor_support_uploaded`,
      `codebtor_support_deleted`, `codebtor_support_downloaded`.
    - Anexo de evidencia (Bloque 8) debe incluir los soportes
      cargados.
    - **Pendiente con el usuario antes de arrancar:** confirmar que
      Firebase Storage está habilitado y obtener el nombre exacto del
      bucket (variable `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`). Si aún no
      existe, primer commit del bloque incluye la guía paso a paso para
      activarlo en consola.

> **Origen del Bloque 12:** solicitud del 2026-05-11. Mientras no esté
> implementado, la sección de “Respaldo económico del codeudor” en el
> wizard funciona como registro informativo (sin archivos), igual que en
> la práctica del mercado informal: el arrendador anota qué documentos
> recibió.

13. **Bloque 13 — Aviso de privacidad completo y página de perfil del usuario**  
    Cubre dos frentes que se refuerzan:
    a) Versión completa del aviso de privacidad
    (`AVISO-PRIV-2026.2`) en `/legal/aviso-privacidad`.
    b) **Página de perfil del usuario** (`/dashboard/account` ya
    existe y se amplía):
      - Acceso directo desde el **header del dashboard**: el correo
        del usuario hoy es texto plano (`<span>` en
        `dashboard-nav.tsx`); se convierte en `Link` a
        `/dashboard/account`.
      - Sección **Datos de cuenta** (ya existente): correo, UID,
        plan, fecha de registro, último acceso, correo verificado.
      - Sección **Mis expedientes**: total de drafts + total de
        contratos firmados + acceso rápido a "Mis arriendos".
      - Sección **Derechos Habeas Data** (Ley 1581/2012): listado
        de los 6 derechos (acceso, rectificación, actualización,
        supresión, revocatoria, conocer el uso), canal por correo
        (`privacidad@arriendoseguro.com.co`), enlace al aviso
        completo y plazos de respuesta (10 días hábiles consultas,
        15 reclamos).
      - Botón **Cerrar sesión** dentro de la página (además del
        que ya existe en la barra de navegación).
      - Botón **Eliminar mi cuenta** que abre `/dashboard/cuenta/eliminar`
        con doble confirmación, descarga previa y manejo de
        retención cuando hay contratos firmados activos.
    - Reescribir `/legal/aviso-privacidad` con la estructura de F1
      (responsable, finalidades, encargados, transferencia
      internacional, derechos, canales, conservación, versión).
    - Listar los encargados activos:
      - Firebase / Google Cloud (datos del expediente, soportes,
        autenticación). Servidores en EE. UU.
      - Vercel (infraestructura sobre AWS) en EE. UU.
      - Resend (correos sobre AWS) en EE. UU.
      - Cloudflare Turnstile (anti-bot, sin almacenamiento de PII).
      - **Reservado** para Supabase si se confirma su uso futuro
        (Postgres / Storage / realtime).
    - Sección **Transferencia internacional** con base legal
      (Decreto 1377/2013 art. 25, Circular SIC 02/2015) y
      autorización expresa del titular al aceptar el consentimiento.
    - Sección **Derechos del titular** con los 6 derechos del art.
      8 de la Ley 1581/2012 y procedimiento de la SIC.
    - Sección **Cómo eliminar tu cuenta**:
      1. Botón en `/dashboard/cuenta/eliminar` (a implementar) con
         confirmación de doble paso, descarga previa de expedientes y
         baja en cascada (auth + entitlements + drafts no firmados).
      2. Si no se puede eliminar por contratos firmados activos,
         explicar plazo legal de retención (mínimo el de la
         vigencia + obligaciones derivadas) y permitir solicitar
         anonimización.
      3. Canal alterno por correo `privacidad@arriendoseguro.com.co`.
    - Endpoint `POST /api/cuenta/eliminar` con verificación de
      contraseña/proveedor + cola de borrado verificable.
    - Versionado del aviso: registrar `AVISO-PRIV-2026.2` en una
      tabla similar a `consentVersions.ts`. Capturar reaceptación si
      cambia la versión vigente.
    - Auditoría: `audit_logs` con `account_deletion_requested`,
      `account_deletion_completed`, `privacy_policy_version_accepted`.
    - **Recomendación:** ejecutar **antes** del Bloque 11 (activación
      oficial de `AS-LEASE-2026.2`) para que producción salga con la
      política completa.

> **Origen del Bloque 13:** solicitud del 2026-05-11. Pendiente con el
> usuario: confirmar la razón social, NIT, dirección de notificación y
> correo oficial de privacidad de ArriendoSeguro; confirmar si Supabase
> entrará efectivamente al stack (para listarlo o dejarlo como reserva).

---

## 5. Riesgos y mitigaciones

- **Romper expedientes ya firmados** → mantener la versión vieja viva
  y elegir por `contractVersion`.
- **Disonancia legal mientras se valida** → todas las cláusulas
  pendientes se marcan con comentario `// PENDIENTE: validar con
  abogado`. El usuario verá `borrador legal en validación` mientras
  esté activo el flag.
- **Tiempo de build/deploy** → cada bloque es pequeño y revisable.
- **Compatibilidad con PWA** → seguir regla
  `arriendoseguro-mobile-pwa.mdc` en cada pantalla.

---

## 6. Aclaraciones que necesitamos del abogado

(Mantener pendientes hasta su confirmación; ya documentadas en
`web/docs/legal-abogado/analisis-comparativo.md` sección 5.)

1. Depósito en dinero como garantía.
2. Renuncias del arrendatario (retención, requerimiento previo).
3. Causales con caución de 6 meses y voluntad libre tras 4 años.
4. Cesión y notificaciones digitales como equivalentes al servicio
   postal autorizado.
5. Mérito ejecutivo con firma electrónica.
6. Honorarios y cobranza dentro de límites no abusivos.
7. Aceptación de prórrogas por parte del codeudor (alcance permitido).

---

## 7. Procedimiento Git por bloque (entorno Windows + OneDrive + Turbopack)

> Procedimiento probado el 2026-05-11. Evita los bloqueos típicos cuando
> `npm run dev` y OneDrive mantienen archivos abiertos en `web/src/`.

Por cada bloque entregado:

1. **Trabajar en una rama de feature** durante la entrega.

   ```powershell
   git checkout -b feat/contrato-2026-2-bloque-XX-descripcion
   ```

2. **Hacer commits parciales** mientras se avanza el bloque.

   ```powershell
   git add <archivos>
   git commit -m "feat(area): descripcion corta"
   ```

3. **Push de la rama de feature** para que Vercel arme un preview:

   ```powershell
   git push -u origin HEAD
   ```

4. **Probar el preview de Vercel** (escritorio + móvil).

5. **Mergear a `main` sin tocar el working tree**:

   ```powershell
   git push origin HEAD:main
   ```

   Esto hace fast-forward de `main` en remoto y dispara el deploy a
   producción. No requiere `git checkout main`, así que no pelea con
   archivos bloqueados por Turbopack o por OneDrive.

6. **Sincronizar `main` local**. Cuando ya no haya bloqueos (idealmente
   cerrando o pausando `npm run dev`):

   ```powershell
   git fetch origin
   git checkout main
   git pull --ff-only
   ```

7. **Borrar la rama de feature** local y remota:

   ```powershell
   git branch -d feat/contrato-2026-2-bloque-XX-descripcion
   git push origin --delete feat/contrato-2026-2-bloque-XX-descripcion
   ```

### Si `git checkout main` falla con bloqueo de directorio

Si Windows responde *“Deletion of directory ... failed. Should I try
again? (y/n)”*:

1. Escribir `n` y Enter para liberar el lock.
2. Detener `npm run dev` con `Ctrl + C`.
3. Si OneDrive sigue sincronizando, pausarlo por un momento.
4. Volver a ejecutar `git checkout main`.

### Si quedan archivos marcados como `D` después de un checkout fallido

```powershell
git checkout HEAD -- .
```

Esto restaura los archivos del commit actual sin perder cambios
confirmados.

---

## 8. Más adelante (post-bloques 1–13)

- Pasarela **Wompi sandbox** + entitlements reales.
- Marketplace ligero y reputación pública (Fase 3 y 4 del roadmap).
- Auditoría de accesibilidad AA.
- KPIs y panel de salud.

---

**Bloque 1 entregado** el 2026-05-11 (commit `5222d0e`).
**Bloques 2 y 3 entregados** el 2026-05-11 (commits `6c996cb`, `ea47792`).
**Ajustes UX en pasos 5 y 6 + sanitización + errores en español**
entregados el 2026-05-11 (commit `53cd37f`).
**Fix valor comercial desconocido + juramento + soporte codeudor**
entregado el 2026-05-11 (commit `8e5c7f2`).
**Bloque 4 entregado** el 2026-05-11: selector de tipo de contrato como
nuevo paso 2 del wizard. Solo `VIVIENDA_URBANA` activa; las demás
modalidades muestran aviso "próximamente disponible" sin romper el
flujo. Audit events `contract_type_selected` y
`contract_type_unavailable_attempted`.
**Bloque 5 entregado** el 2026-05-11: cláusulas especiales como nuevo
paso 9 del wizard (entre Servicios y Resumen). Catálogo común
(mascotas, fumadores, parqueadero, teletrabajo, mobiliario, zonas
verdes, seguridad) más opción «Otra» con texto libre. Aviso fijo de
costo adicional. Las selecciones quedan en `ContractDraft.specialClauses`
y se ven en el resumen previo; aún no se imprimen en el contrato
(eso lo activa la plantilla `AS-LEASE-2026.2` en el Bloque 11). Audit
event `special_clauses_updated`.

**Próximo paso confirmado por el usuario (2026-05-11):** seguimos en el
orden de bloques. El usuario está validando `8e5c7f2`. Apenas dé visto
bueno arrancamos **Bloque 4 (selector de tipo de contrato)**.

**Notas adicionales del usuario para no olvidar (2026-05-11):**

- Bloque 12 sigue pendiente: dejar lista la carga de archivos físicos de
  soporte del codeudor con Firebase Storage y sus reglas de seguridad.
- Bloque 13 sigue pendiente: aviso de privacidad completo (`AVISO-PRIV-2026.2`)
  con encargados (Firebase, Vercel/AWS, Resend, eventualmente Supabase),
  transferencia internacional, derechos Habeas Data y canal para
  eliminación de cuenta. Recomendación: ejecutarlo antes del Bloque 11
  para que la activación oficial salga con la política completa.
