# Impuestos en Colombia — ArriendoSeguro (guía + plan de implementación)

> **Aviso:** documento de trabajo, NO es asesoría tributaria. La obligación exacta
> depende de tu forma jurídica (persona natural / SAS), tus ingresos y tu registro
> en el RUT. Confírmalo con un **contador**. Fuentes al final.

## 1. ¿Debe ArriendoSeguro cobrar IVA?

El software / SaaS está gravado con **IVA general del 19%**. Pero **solo se cobra si
el vendedor es "Responsable de IVA"**.

- **Persona natural NO responsable de IVA** (no cobra IVA) si cumple TODO (Art. 437 E.T.):
  ingresos brutos del año < **3.500 UVT**, patrimonio bruto < 4.500 UVT, consignaciones
  < 3.500 UVT, un solo establecimiento, sin franquicia, sin ser usuario aduanero, y no
  celebrar contratos de venta/servicios gravados por encima de 3.500 UVT.
- Si supera esos topes → **Responsable de IVA** → cobra 19% y declara (bimestral o, en
  Régimen Simple, anual).

**Valores de referencia (UVT):**
| Año | 1 UVT | 3.500 UVT (tope no responsable) |
|---|---|---|
| 2025 | $49.799 | ~$174.300.000 |
| 2026 | $52.374 | ~$183.300.000 |

**Conclusión práctica (etapa temprana):** si arrancas como persona natural con ingresos
bajos, muy probablemente eres **NO responsable de IVA → el precio ($49.900) es final, sin
IVA**. Al superar ~$183M/año pasas a responsable y debes **agregar 19%**.

## 2. Otros impuestos / obligaciones

- **Facturación electrónica (DIAN):** obligatoria para casi todo el que vende (incluye
  Régimen Simple y muchos no responsables). Se emite con el sistema gratuito de la DIAN o
  un proveedor autorizado. **Es lo primero a resolver operativamente**, independientemente
  del IVA.
- **ICA** (Industria y Comercio): municipal, varía por ciudad (Medellín, Bogotá…). Aplica a
  la actividad de servicios.
- **Retención en la fuente:** relevante si vendes a empresas/grandes contribuyentes (B2B);
  poco relevante vendiendo a personas naturales (B2C).
- **Régimen Simple de Tributación (RST):** opcional (ingresos < 100.000 UVT). Unifica renta
  + ICA + anticipos en un pago bimestral (tarifa 1,2%–14,5% según actividad). Suele convenir
  a negocios pequeños. Bajo RST, el IVA (si aplica) se declara distinto.

## 3. La tarifa de IVA NO se auto-actualiza cada año

- La **tarifa (19%)** la fija la ley; solo cambia por **reforma tributaria** (esporádico).
- Lo que **sí cambia cada año es la UVT** (la DIAN la publica ~diciembre). La UVT mueve los
  **topes** (cuándo te vuelves responsable de IVA) y otros cálculos.
- Por eso el diseño correcto no es "auto-actualizar el IVA", sino:
  1. Campo editable de **tarifa IVA** (por si hay reforma) + toggle **responsable / no
     responsable**.
  2. Campo/auto-actualización de **UVT** anual (con alerta para confirmar).
  3. **Alerta** cuando los ingresos acumulados del año se acerquen al tope de 3.500 UVT
     (aviso "estás por volverte responsable de IVA").

## 4. Plan de implementación en la app

### 4.1 Configuración tributaria (Firestore + admin)
Documento `tax_config` (una sola fila), editable en `/admin`:
```
{
  ivaResponsable: boolean        // ¿la empresa es responsable de IVA? (hoy: false)
  ivaRate: number                // 19 (por si cambia por reforma)
  priceMode: "iva_incluido" | "iva_por_agregar"   // B2C: iva_incluido
  uvtValue: number               // UVT del año vigente (p. ej. 52374)
  uvtYear: number                // 2026
  regime: "no_responsable" | "responsable" | "simple"
  updatedAt, updatedBy
}
```

### 4.2 Lógica de precios
- Guardar el **precio base** y calcular el IVA a partir de la config.
- **No responsable:** total = precio, sin línea de IVA.
- **Responsable, priceMode = iva_incluido (recomendado B2C):** el precio mostrado ya incluye
  IVA; en la factura se **discrimina** (base + IVA 19%). base = precio / 1,19; iva = precio − base.
- **Responsable, iva_por_agregar:** total = precio × (1 + ivaRate/100).
- Centralizar en un helper `computeTaxedPrice(baseCop, taxConfig)` que devuelva
  `{ base, iva, total, ivaApplies }` y usarlo en el carrito, checkout y comprobantes.

### 4.3 Mensajes / UI
- **/dashboard/plans y carrito:** mostrar "IVA incluido" o "+ IVA 19%" solo cuando
  `ivaResponsable`. Si no responsable, no mencionar IVA (o "No responsable de IVA").
- **Comprobante / factura:** discriminar base + IVA cuando aplique. (La **factura
  electrónica** válida ante la DIAN requiere proveedor/integración — ver 4.6.)
- **Legales (Términos / facturación):** una cláusula corta del tratamiento tributario según
  el régimen vigente.

### 4.4 Campo en el admin (tu panel de creador)
Sección "Impuestos" en `/admin`:
- Toggle **Responsable de IVA** (hoy off).
- **Tarifa IVA (%)** editable.
- **UVT vigente** + **año** (editable).
- Selector de **régimen**.
- Botón "Guardar" (con auditoría updatedBy/updatedAt).

### 4.5 Auto-actualización + alerta (reusa la observabilidad ya construida)
- Cron anual/mensual que consulta la **UVT vigente** (fuente confiable) y, si difiere de la
  configurada, **manda alerta por Telegram/correo** ("La UVT parece haber cambiado a $X,
  confirma en el admin"). NO cambia el valor solo: **espera tu confirmación**.
- Alerta cuando los **ingresos acumulados del año** (suma de `platform_payments`) superen,
  p. ej., el 80% de 3.500 UVT → "te acercas al tope de responsable de IVA".
- (La tarifa de IVA se vigila igual, pero cambia rara vez.)

### 4.6 Facturación electrónica (aparte, operativo)
- Evaluar proveedor de **factura electrónica DIAN** (Alegra, Siigo, Factus, etc.) o el
  sistema gratuito de la DIAN. Integrar cuando se decida emitir facturas formales.
- Mientras tanto, el "comprobante" de la app es un soporte interno, no una factura fiscal.

## 5. Qué confirmar con el contador (antes de activar cobros de IVA)
1. Tu forma jurídica y régimen (persona natural / SAS; ordinario / Simple).
2. Si YA eres responsable de IVA o no (según ingresos/patrimonio).
3. Si tu actividad (código CIIU de software/servicios) está gravada al 19% o tiene trato
   especial.
4. Obligación y forma de **facturación electrónica** para tu caso.
5. **ICA** de tu municipio.

## Fuentes
- IVA 2025/2026 y topes no responsable — actualícese, Alegra, DIAN.
- SaaS sujeto a IVA 19% en Colombia — payproglobal.
- Régimen Simple y facturación electrónica — Alegra, Siigo, DIAN.

(Ver enlaces en el mensaje del chat donde se compartió esta investigación.)
