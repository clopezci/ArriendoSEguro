# `AS-LEASE-2026.2` — Borrador en evolución

Esta carpeta contiene la **versión 2026.2** del contrato de vivienda urbana.
**No se utiliza todavía.** El render activo del wizard sigue siendo
`AS-LEASE-MVP-2026.1` (ver `web/src/domain/contracts/renderResidentialLeaseContract.ts`).

## Estado

- Plantilla redactada con los cambios pedidos por el usuario y las alertas
  del análisis comparativo con el modelo del abogado
  (`web/docs/legal-abogado/analisis-comparativo.md`).
- Variables nuevas listas en `contractVariables.ts`.
- Render dedicado disponible en `renderResidentialLeaseContract.ts`.
- **Pendiente:** validación final del abogado para temas marcados con
  `// PENDIENTE: validar con abogado`.

## Cambios respecto a `AS-LEASE-MVP-2026.1`

1. **TIPO DE CONTRATO** explícito como cláusula inicial.
2. **CANON Y OBLIGACIÓN DE PAGO** reforzada con día(s) y método.
3. **LIQUIDACIÓN DE SUMAS ADEUDADAS** (cláusula nueva).
4. **CLÁUSULA DE CODEUDOR SOLIDARIO** reforzada con:
   - obligación solidaria,
   - notificación clara,
   - autorización de datos personales,
   - aceptación de prórrogas (con disclaimer hasta confirmar abogado).
5. **CLÁUSULAS ESPECIALES SOLICITADAS POR LAS PARTES** (bloque condicional
   nuevo).
6. **AUTENTICACIÓN NOTARIAL** opcional (bloque condicional nuevo).
7. **FIRMA ELECTRÓNICA REFORZADA** con OTP por email, IP, fecha/hora,
   user agent, hash del documento, certificado de evidencia y versión
   inmutable, alineada con la Ley 527 de 1999.
8. **ANEXOS** extendida con: contrato firmado, anexo de firma
   electrónica, registro de pagos, soportes de pago, estado de cuenta y
   comunicaciones de mora.

## Cuándo se activa

Se activa cuando termine el plan de mejoras descrito en
`web/docs/plan-mejoras-contrato-flujo.md` (bloques 2 a 10) y el abogado
confirme el contenido. Hasta entonces, los nuevos expedientes se siguen
generando con la versión `AS-LEASE-MVP-2026.1` para no afectar a usuarios
existentes.

## Compatibilidad

- No se modifican expedientes ya creados.
- `renderResidentialLeaseContract` (capa actual) no usa esta carpeta.
- El switch oficial se hará en el bloque 11 del plan.
