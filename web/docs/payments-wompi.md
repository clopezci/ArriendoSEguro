# Módulo de pagos de plataforma (Wompi)

## Propósito

Este módulo cobra únicamente el uso de Arriendo Seguro (Plan Plus).

- No recauda cánones de arriendo.
- No procesa pagos de arriendo entre arrendador y arrendatario.
- No guarda datos de tarjeta.

## Planes y flujo

- **Plan Básico Demo**: gratis, sin contratos reales, documentos con marca de agua `DOCUMENTO DEMO SIN VALIDEZ`.
- **Plan Plus**: promoción `$49.900 COP` (lista `$89.900 COP`) por **contrato gestionado** en la plataforma; sin mensualidades. Renovación o contrato nuevo = nuevo expediente y pago según tarifa vigente.
- **Plan Premium**: futuro, no comprable.

Flujo Plus:

1. Usuario autenticado crea orden en `POST /api/platform-payments/create-order`.
2. Se genera checkout externo (Wompi o mock).
3. Wompi notifica webhook.
4. Si webhook válido + aprobado + monto/moneda correctos, se crea `platform_payment`.
5. Se crea `access_entitlement` `plus_paid` con cupo `1`.
6. Al crear contrato real se consume el entitlement (`contractsUsed`).

## Variables de entorno

Configurar solo en servidor:

- `WOMPI_PUBLIC_KEY`
- `WOMPI_PRIVATE_KEY`
- `WOMPI_EVENTS_SECRET`
- `WOMPI_INTEGRITY_SECRET`
- `WOMPI_ENVIRONMENT` (`sandbox` o `production`)

`WOMPI_EVENTS_SECRET` se usa para validación criptográfica de webhook.
`WOMPI_INTEGRITY_SECRET` se usa para firma de integridad de checkout.

## Verificación criptográfica del webhook

Se valida en `verifyWompiWebhookSignature(eventBody, headers)`:

1. Lee `signature.checksum` y `signature.properties`.
2. Construye string concatenando los valores de `signature.properties` en orden.
3. Anexa `WOMPI_EVENTS_SECRET` (fallback a `WOMPI_INTEGRITY_SECRET` si falta).
4. Calcula SHA-256.
5. Compara checksum con `timingSafeEqual`.
6. Si no coincide, rechaza evento y audita `platform_payment_webhook_invalid_signature`.

## Eventos procesados

Se procesan eventos de transacción (`transaction.*`).

Estados:

- `APPROVED` -> orden `approved`, crea `platform_payment`, crea `access_entitlement`.
- `DECLINED` / `ERROR` -> orden `rejected`.
- `VOIDED` -> orden `cancelled`.
- `PENDING` -> orden `pending`.

## Idempotencia

Se evita duplicar pagos/accesos cuando llega el mismo webhook más de una vez:

- clave de deduplicación: `orderId + providerPaymentId`.
- si ya existe, se audita `platform_payment_webhook_duplicate_ignored`.
- no crea segundo `platform_payment`.
- no crea segundo `access_entitlement`.

## Cómo probar en mock (fase inicial)

1. Crear orden Plus.
2. Usar `POST /api/platform-payments/mock-approve` con `orderId`.
3. Verificar:
   - orden `approved`
   - `platform_payment` creado
   - `access_entitlement` plus activo (cupo 1)

## Cómo probar webhook

1. Configurar secretos Wompi.
2. Enviar evento `transaction.updated` con firma válida.
3. Probar casos:
   - firma inválida
   - monto incorrecto
   - moneda distinta
   - aprobado válido
   - duplicado

## Pruebas automatizadas de integración

Harness:

- `src/__tests__/integration/platform-payments/mockFirebaseAuth.ts`
- `src/__tests__/integration/platform-payments/mockFirestore.ts`
- `src/__tests__/integration/platform-payments/mockRequest.ts`
- `src/__tests__/integration/platform-payments/mockWompiEvent.ts`
- `src/__tests__/integration/platform-payments/testDataFactory.ts`

Suite endpoint-a-endpoint:

- `src/__tests__/integration/platform-payments/platform-payments.integration.test.ts`

Comando:

```bash
npm test
```

La suite cubre los 15 escenarios críticos (autenticación, ownership de orden, demo vs plus, webhook inválido/duplicado/aprobado e idempotencia).

## Auditoría relevante

- `platform_order_created`
- `platform_checkout_created`
- `platform_payment_webhook_received`
- `platform_payment_webhook_invalid_signature`
- `platform_payment_webhook_amount_mismatch`
- `platform_payment_webhook_currency_mismatch`
- `platform_payment_webhook_duplicate_ignored`
- `platform_payment_approved`
- `platform_payment_rejected`
- `access_entitlement_created`
- `access_entitlement_used`
- `access_blocked_no_plus_plan`

## Nota comercial

Plan Plus es **pago único por expediente** y no mensualidad.

