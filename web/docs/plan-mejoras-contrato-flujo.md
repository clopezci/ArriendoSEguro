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

- F1. Página `/legal/aviso-privacidad` ya existe → actualizar para
  cubrir tratamiento extendido (firma, evidencia, comunicaciones).
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

## 8. Más adelante (post-bloques 1–11)

- Pasarela **Wompi sandbox** + entitlements reales.
- Marketplace ligero y reputación pública (Fase 3 y 4 del roadmap).
- Auditoría de accesibilidad AA.
- KPIs y panel de salud.

---

**Bloque 1 entregado** el 2026-05-11 (commit `5222d0e`).

**Próximo paso recomendado:** ejecutar Bloque 2 (consentimiento de
datos en registro y en inicio del wizard).
