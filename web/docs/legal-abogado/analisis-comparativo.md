# Análisis comparativo — Modelo del abogado vs. plantilla actual

> Documento de trabajo. **No reemplaza** la plantilla actual ni el modelo del abogado.
> Sirve como insumo para decidir qué incorporar de forma estructurada y versionada.

- Modelo del abogado (referencia): `CONTRATO DE ARRENDAMIENTO modelo.docx` y su texto plano `contrato-modelo-abogado-extraido.txt`.
- Plantilla actual de la app: `web/src/domain/contracts/contractClauses.ts` (versión `AS-LEASE-MVP-2026.1`).

---

## 1. Resumen ejecutivo

El modelo del abogado es un **contrato clásico de vivienda urbana en Medellín**, redactado para un caso particular (un inmueble específico, $1.700.000 de canon, 1 sep 2025). Está alineado con la **Ley 820 de 2003**, el Código Civil y el Código General del Proceso, y es bastante completo en obligaciones, terminación y cobranza.

Sin embargo, **no contempla**:
- Firma electrónica ni trazabilidad digital.
- Tratamiento de datos personales (Ley 1581).
- Plataforma como herramienta documental.
- Evaluación estructurada de la experiencia.

Y **sí incluye una cláusula de depósito en dinero** ($1.000.000 “de garantía”) que entra en zona gris frente al **artículo 16 de la Ley 820**, que prohíbe depósitos en dinero o cauciones reales en arrendamiento de vivienda urbana. Es práctica de mercado, pero discutible jurídicamente; debe validarse expresamente con el abogado.

La plantilla actual de la app está bien estructurada, parametrizada y alineada con la **fase inicial digital**, pero le faltan elementos clave que sí están bien resueltos en el modelo del abogado: prórroga automática, preavisos, indemnizaciones, cobro ejecutivo, mérito ejecutivo, renuncias de retención, derecho de inspección, abandono, etc.

**Conclusión:** la mejor jugada es **fusionar** lo bueno del modelo del abogado dentro de nuestra plantilla, sin perder lo que ya tenemos (firma electrónica, datos personales, evaluación, prohibición de depósito).

---

## 2. Comparación cláusula por cláusula

| Tema | Modelo del abogado | Plantilla actual (app) | Diagnóstico |
|---|---|---|---|
| Encabezado y partes | "ARRENDADORAS / ARRENDATARIOS / CODEUDOR" en plural; soporta varios titulares | Singular: arrendador, arrendatario, codeudor opcional | **Mejorar**: soportar múltiples arrendadores/arrendatarios opcional. |
| Objeto e inmueble | Dirección + barrio + ciudad + destinación a vivienda | Dirección, ciudad, departamento, matrícula, tipo + nota IGAC | Plantilla actual es más sólida. |
| Duración | 12 meses por defecto | Configurable en meses | Plantilla actual ya es flexible. |
| Prórroga automática | Sí, prórroga 1 año si nadie manifiesta terminación con antelación legal (Ley 820 art. 6) | **No la menciona explícitamente** | **Adoptar** del modelo. |
| Preaviso 3 meses | Sí, vía servicio postal autorizado (Ley 820 arts. 22 y 24) | **No** | **Adoptar** del modelo (con flexibilidad para canal digital + soporte). |
| Entrega anticipada | Indemnización **3 meses** de canon | **No regula** | **Adoptar** del modelo. |
| Canon mensual | Pago primeros 5 días, vía consignación a cuenta Bancolombia | Configurable: día de pago + método de pago | Plantilla actual es más flexible y neutral. |
| Reajuste | IPC año calendario anterior (100%); tope 1% valor comercial / 2× avalúo catastral | Reajuste cada 12 meses con tope legal aplicable, sin fórmula explícita | **Mejorar**: dejar la fórmula del IPC explícita y los topes. |
| Causales de incumplimiento del arrendatario | Lista detallada (servicios, restitución, entrega intempestiva, daños, mora, deber de cuidado) | Lista de obligaciones genéricas | **Adoptar** la lista detallada. |
| Recibo y estado, pintura tras 24 meses (art. 1985 CC) | Sí, con condicionante de >24 meses | Solo "condiciones aptas" + inventario | **Adoptar** con la salvedad de los 24 meses. |
| Reparaciones por daño / prohibición de mejoras sin permiso | Sí, con renuncia a indemnización por mejoras no autorizadas | Solo deber genérico | **Adoptar**. |
| Servicios públicos | Obligación clara, mora = causal de terminación, no responsabilidad del arrendador por interrupciones | Detalle pactable + responsable | **Mejorar**: incluir explícitamente que mora en servicios = causal de terminación. |
| Garantía a favor de empresas de SP (art. 15 Ley 820) | Sí | **No** | **Adoptar** como bloque opcional condicional. |
| **Depósito en dinero ($1.000.000)** | Sí, lo pacta como garantía por daños o falta de pago de SP | **NO**, prohibido por art. 16 Ley 820 | **Bandera legal**: pedir al abogado fundamento expreso para mantenerlo o eliminarlo. La plataforma no debe forzarlo. |
| Obligaciones (Ley 820 arts. 8 y 9 + Cód. Civil Libro 4) | Cita explícita | Lista genérica | **Adoptar** la cita normativa expresa. |
| Renuncias del arrendatario (retención, indemnización por mejoras, requerimiento previo en mora) | Sí | **No** | **Adoptar** con cuidado: el cliente debe leerlas y aceptarlas explícitamente. |
| Subarriendo y cesión | Prohibición + autorización para que el arrendador ceda (art. 1960 CC) por servicio postal | Solo prohibición de subarrendar/ceder por el arrendatario | **Mejorar**: regular cesión por el arrendador, con consentimiento informado. |
| Cobro ejecutivo SP y otros conceptos | Sí, expreso | **No** | **Adoptar**. |
| Honorarios de abogado, cobranza, reposición inventario, cobro ejecutivo | Sí | **No** | **Adoptar** (bandera: revisar costos abusivos). |
| Causales de terminación por arrendador (uso propio, demolición, venta) con caución 6 meses | Sí, con detalle de Ley 820 arts. 22-25 | Solo causales generales | **Adoptar** del modelo. |
| Voluntad libre tras 4 años de ejecución (indemnización 1.5 meses) | Sí | No | **Adoptar**. |
| Causales de terminación por arrendatario | Suspensión de servicios, afectación al goce, derechos vulnerados, preaviso 3 meses | No las detalla | **Adoptar**. |
| Derecho de inspección del arrendador | Sí, con presencia del arrendatario o autorizado | **No** | **Adoptar**. |
| Enajenación del bien | Sí, no responsabilidad por perjuicios | **No** | **Adoptar** (medido). |
| Mérito ejecutivo del contrato | Sí, expreso | **No** | **Adoptar**, alineado con bitácora digital. |
| Gastos del contrato a cargo del arrendatario | Sí, todos | **No** | **Discutir con abogado**: hoy en día se suele dividir; no automatizar contra el arrendatario. |
| Autorización para corregir dirección/nomenclatura | Sí | **No** | **Adoptar** como soporte operativo (lo conecta con la nota catastral del IGAC que ya tenemos). |
| Legislación aplicable | Cód. Civil + CGP + Ley 820 + decretos | "Normas civiles y comerciales aplicables, especialmente Ley 820 de 2003" | Plantilla actual está bien; mejorar mencionando CGP y decretos reglamentarios. |
| Notificaciones | Direcciones registradas en el contrato | Notificación + correo de cada parte | Plantilla actual es más completa (incluye correo). |
| Abandono de tenencia (entrar con 2 testigos tras 2 meses) | Sí | **No** | **Adoptar**, con redacción precisa. |
| Firma + autenticación notarial | Sí, firma + notaría | Firma electrónica simple + bitácora | **Mantener firma electrónica**; el notarial puede quedar como **opcional** declarado en el contrato. |
| Tratamiento de datos personales | **No** | Sí (cláusula DÉCIMA TERCERA) | **Mantener** lo nuestro. |
| Firma electrónica | **No** | Sí (cláusula DÉCIMA SEGUNDA) | **Mantener** lo nuestro. |
| Evaluación estructurada | **No** | Sí (cláusula DÉCIMA CUARTA) | **Mantener** lo nuestro. |
| Prohibición de depósitos en dinero | **Contradice** | Sí (cláusula DÉCIMA PRIMERA) | **Mantener** salvo concepto del abogado en contrario. |
| Plataforma como herramienta documental | **No** | Sí (cláusula VIGÉSIMA + SEXTA) | **Mantener** lo nuestro. |
| Cláusula de codeudor solidario | Encabezado + firma | Comparecencia, cláusula, notificación, firma (todo condicional) | Plantilla actual es más sólida. |
| Anexos integrales (inventario, actas, pagos, firma, datos, evaluación) | Solo inventario implícito | Sí, todos | **Mantener** lo nuestro. |

---

## 3. Cambios recomendados (sí adoptar, ordenados por prioridad)

1. **Prórroga automática** + **preaviso de 3 meses** (Ley 820 arts. 6, 22 y 24).
2. **Indemnización por entrega anticipada del arrendatario** (3 meses de canon).
3. **Causales detalladas de incumplimiento del arrendatario** (mora, servicios, daños, entrega intempestiva).
4. **Reajuste con fórmula explícita** (IPC año calendario anterior + topes legales).
5. **Servicios públicos:** mora como causal de terminación + recibo en buen estado + no responsabilidad por interrupciones.
6. **Garantía a favor de empresas de SP** (art. 15 Ley 820) como bloque condicional.
7. **Renuncias del arrendatario** (retención, indemnización por mejoras no autorizadas, requerimiento previo en mora) con consentimiento informado.
8. **Cesión del contrato por el arrendador** con notificación clara.
9. **Cobro ejecutivo + mérito ejecutivo del contrato + honorarios y costas**.
10. **Causales de terminación detalladas** (por arrendador y por arrendatario, con caución de 6 meses y voluntad libre tras 4 años de ejecución).
11. **Derecho de inspección** (con presencia del arrendatario o autorizado).
12. **Abandono de tenencia** (recuperación con 2 testigos tras 2 meses).
13. **Soporte para múltiples arrendadores y arrendatarios** (ARRENDADORES/ARRENDATARIOS en plural cuando aplique).
14. **Autorización para corregir nomenclatura/dirección** del bien.

> Todos los anteriores se incorporarían **manteniendo** firma electrónica, tratamiento de datos, evaluación estructurada y la plataforma como herramienta documental.

---

## 4. Cambios NO recomendados (o requieren matiz)

- **Depósito en dinero ($1.000.000) como garantía por daños/SP:** chocaría con el art. 16 Ley 820. Mantener nuestra cláusula de prohibición salvo concepto expreso del abogado, y aun así marcado como **alto riesgo**.
- **Pago obligatorio por consignación a una sola cuenta bancaria:** la plataforma debe ser neutral; mantener canal de pago **acordable** entre partes.
- **Autenticación notarial obligatoria:** dejarla como **opcional**, recomendada cuando las partes quieran reforzar mérito ejecutivo, pero no como requisito.
- **Todos los gastos del contrato a cargo del arrendatario:** redactar de forma negociable (no automatizado contra una sola parte).

---

## 5. Banderas legales para validar con el abogado

1. **Depósito en dinero**: ¿bajo qué fundamento jurídico actual lo sostiene? (Ley 820 art. 16 + jurisprudencia reciente).
2. **Renuncias del arrendatario** (retención, requerimiento previo): redacción precisa para que sea exigible y no se considere abusiva.
3. **Causales de terminación con caución de 6 meses** y **voluntad libre tras 4 años**: confirmar redacción literal alineada con texto vigente de la Ley 820.
4. **Cesión por el arrendador con notificación postal**: viabilidad de notificación digital equivalente (Ley 1581 + Decreto 1377 + medio idóneo aceptado).
5. **Mérito ejecutivo del contrato firmado electrónicamente** (Ley 527 de 1999 + jurisprudencia firma electrónica).
6. **Honorarios y cobranza**: límites para no convertirse en cláusula abusiva.
7. **Aclaración**: el modelo enviado es un caso particular; ¿podemos contar con su versión genérica/anonimizada como base oficial para la plantilla del producto?

---

## 6. Pasos sugeridos (decisión paso a paso)

1. **Revisar este análisis con el abogado** en una llamada de 30–45 min.
2. Confirmar punto por punto los cambios recomendados (sección 3).
3. Resolver banderas legales (sección 5), especialmente depósito en dinero.
4. Elaborar un **borrador `AS-LEASE-2026.2`** con los cambios aceptados (sin tocar `AS-LEASE-MVP-2026.1` hasta que esté aprobado).
5. Validación final del abogado sobre el borrador.
6. Implementar en código:
   - Actualizar `web/src/domain/contracts/contractClauses.ts` con nuevas cláusulas y placeholders.
   - Actualizar `contractVariables.ts` con nuevas variables.
   - Subir versión `contractVersion: "AS-LEASE-2026.2"` en `types.ts`.
   - Mantener compatibilidad con expedientes ya firmados con la versión anterior.
7. Probar render + PDF + firma en demo.
8. Publicar y documentar en `web/docs/contrato-vivienda-urbana-revision-legal.txt`.

---

## 7. Lo que NO toca este documento

- No reemplaza la plantilla actual.
- No modifica el `.docx` original del abogado.
- No constituye asesoría legal.
- Toda decisión final debe quedar respaldada por concepto del abogado.
