# Análisis de rentabilidad de los planes de pago

> Actualizado 2026-06-05 con **datos reales investigados** (Firma.dev, Wompi,
> proveedor colombiano Nucli). Ciclo del contrato = **1 año** (recurrencia ~1
> compra/año). Moneda: COP. Tipos usados: **USD ≈ 4.000**, **EUR ≈ 4.500**.

## 0. Datos investigados (con fuente)

- **Firma.dev (firma electrónica por API):** **€0,029 por *envelope*** (un envelope = un documento con todos sus firmantes), sin mínimos ni mensualidad, pago por uso. ≈ **~130 COP por contrato firmado**. Cumple **ESIGN/UETA (EE.UU.) y eIDAS (UE)**; **NO declara explícitamente validez en Colombia** → a confirmar para Ley 527.
- **Proveedor colombiano (Nucli / SIGNADOC), con certificado y validez local:** paquetes — $32.000/20, $75.000/50, $140.000/100, $260.000/200 firmas → **~$1.300–1.600 COP por firma** (incluye autenticación email+SMS y **certificado de firma**). Si "firma" = por firmante, un contrato con 3 firmantes ≈ **~$3.900–4.800 COP**.
- **Wompi (pasarela, Plan Avanzado):** **2,65% + $700 + IVA(19% sobre la comisión)**. PSE: 2,69% + IVA. (El Plan Gateway no cobra fee a Wompi; se negocia con Bancolombia.)
- **Resend / Vercel / Firebase:** cubiertos por capas gratis a bajo volumen; marginal por contrato **~centavos** (~300 COP).
- **SMS (Twilio a Colombia, solo planes de pago):** ~$0,04–0,08/SMS ≈ 160–320 COP; ~10/año → **~3.000 COP**.

**Conclusión de costos:** la **firma certificada NO es cara**: ~130 COP con Firma.dev (si valida en CO) o ~$1.300–4.800 COP con un proveedor colombiano. Mucho menos que el estimado inicial.

## 1. Costo por contrato de pago (al año) — números reales

| Costo | COP | Nota |
|---|---|---|
| Infraestructura | ~300 | Centavos. |
| SMS (solo pago) | ~3.000 | ~10/año. Evitable. |
| Firma certificada (Firma.dev) | **~130** | Si valida en CO. Costo **por uso**. |
| Firma certificada (proveedor CO, 3 firmantes) | **~4.000** | Caso conservador, con certificado local. |
| Pasarela Wompi | (2,65%×precio + 700) × 1,19 | Por transacción exitosa. |

## 2. Margen por escenario — firma CON proveedor colombiano (~$4.000, caso conservador)

Costo Plus = infra 300 + SMS 3.000 + firma 4.000 + Wompi. Micropago = infra 300 + firma 4.000 + Wompi (sin SMS).

| Escenario | Ingreso | Wompi fee | Costo total | **Margen** | % |
|---|---|---|---|---|---|
| Plus **lista** 89.900 | 89.900 | ~3.668 | ~10.968 | **~78.900** | 88% |
| Plus **promo** 49.900 | 49.900 | ~2.406 | ~9.706 | **~40.200** | 81% |
| Plus promo **−50% referido** 24.950 | 24.950 | ~1.620 | ~8.920 | **~16.000** | 64% |
| **Micropago** 10.000 (solo firma) | 10.000 | ~1.148 | ~5.448 | **~4.550** | 46% |

## 3. Margen con Firma.dev (~130 COP, si valida en CO)

Aquí la firma es casi gratis → márgenes aún mejores:

| Escenario | Ingreso | Costo total | **Margen** | % |
|---|---|---|---|---|
| Plus promo 49.900 | 49.900 | ~5.836 | **~44.100** | 88% |
| Plus promo −50% 24.950 | 24.950 | ~5.050 | **~19.900** | 80% |
| **Micropago** 10.000 | 10.000 | ~1.578 | **~8.420** | 84% |

## 4. Puntos de equilibrio (break-even)

- **Micropago $10.000:** pierde solo si la firma certificada supera **~$8.550 COP**. Ningún proveedor investigado llega ahí (Firma.dev ~130; Nucli ~$1.300–1.600/firma). **→ El micropago de $10k es seguro.**
- **Plus con −50% ($24.950):** aguanta firma de hasta **~$20.000 COP**. Sin riesgo.
- **Plus precio completo:** sano siempre (81–88%).

## 5. Conclusiones (con datos reales)

1. **Todos los escenarios son rentables**, incluido el micropago de $10k y el −50% por referido. El margen va de **46% a 88%**.
2. La **firma certificada dejó de ser el riesgo**: es barata (~130 COP Firma.dev / ~$4k proveedor CO). El estimado inicial (3k–12k) era pesimista.
3. **El único matiz real es legal, no de costo:** Firma.dev declara validez **US/EU**, no Colombia. Para máxima certeza Ley 527 conviene un **proveedor colombiano con certificado** (~$1.300–1.600/firma, sigue siendo barato). La **firma interna que ya tienes** (Ley 527, firma electrónica simple) es válida para arrendamiento en la mayoría de casos.
4. **Recurrencia 1/año + CAC ~0** (referidos): incluso el caso más delgado (micropago, 46%) aporta. Las **comisiones de aliados** (un seguro = $20–80k) multiplican la rentabilidad blendada.
5. **Wompi** se lleva ~$2.400 de un Plus de $49.900 (≈5% efectivo con IVA) — manejable.

## 6. Recomendaciones de precio

- **Mantén el micropago en $10.000:** es seguro con cualquier proveedor investigado.
- **Para la firma certificada legal en CO**, prioriza un **proveedor colombiano con certificado** (Nucli u otro) sobre Firma.dev, salvo que Firma.dev confirme validez Ley 527. Diferencia de costo (~$4k vs ~130 COP) es irrelevante frente al riesgo legal.
- **−50% por referido:** seguro; no necesita piso por ahora (margen 64–80%).
- **Confirmar con proveedores:** (a) ¿Firma.dev valida en Colombia? (b) precio "por firma" de Nucli ¿es por firmante o por documento? (c) plan/fee final de Wompi (Avanzado vs Gateway).

## Fuentes

- [Firma.dev — Electronic Signature API €0,029](https://firma.dev/)
- [Nucli SIGNADOC — Planes y precios firma electrónica (CO)](https://www.nucli.com.co/precios-firma-electronica-documentos)
- [Wompi — Tarifas modelo Gateway / Avanzado](https://soporte.wompi.co/hc/es-419/articles/360035203574--Cu%C3%A1les-son-las-tarifas-que-me-cobran-por-las-transacciones-en-Wompi-bajo-el-modelo-Gateway)
- [Wompi — Planes y tarifas](https://wompi.com/es/co/planes-tarifas/)
