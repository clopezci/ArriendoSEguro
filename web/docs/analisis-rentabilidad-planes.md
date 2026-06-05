# Análisis de rentabilidad de los planes de pago

> Borrador (2026-06-05). Ciclo del contrato = **1 año** (recurrencia ~1 compra/año).
> Moneda: COP (USD ≈ 4.000 COP). **Dos números los debe confirmar el fundador**
> porque mandan todo: (a) costo por **firma certificada** (Firma.dev) y (b) la
> **comisión de la pasarela** (Wompi). El resto son estimados realistas.

## 1. Supuestos de costo por contrato de pago (al año)

| Costo | Estimado (COP) | Nota |
|---|---|---|
| Infraestructura (Firebase + Vercel + Resend) | **~300** | Centavos; ruido. |
| SMS (solo planes de pago; ~10–24/año) | **~3.000–7.000** | Uso 4.000 como medio. Evitable si se limita el SMS. |
| **Firma certificada** (Firma.dev, 2–3 firmantes) | **? (rango 3.000 / 6.000 / 12.000)** | **Confirmar.** Es un costo **por uso**: solo aplica si se usa la certificada. |
| **Pasarela** (Wompi, cuando esté en vivo) | **~3% + ~900 fijo** | **Confirmar** (incluye IVA sobre la comisión aprox). |

**Clave:** la **firma interna (Ley 527) es gratis** para nosotros. La **certificada es un costo por USO** → solo pega cuando alguien efectivamente la usa (el micropago, o un Plus que la elija). Un Plan Plus que firme con la interna casi no nos cuesta.

## 2. Ingreso por escenario

| Escenario | Precio (COP) |
|---|---|
| Plan Plus — precio de lista | 89.900 |
| Plan Plus — promoción | 49.900 |
| Plan Plus — promo con **−50% referido** | 24.950 |
| **Micropago** (solo desbloqueo de firma certificada) | 10.000 |

## 3. Margen por escenario (firma certificada = caso MEDIO 6.000)

Costo Plus = infra 300 + SMS 4.000 + firma 6.000 + pasarela (3%+900).
Micropago = infra 300 + firma 6.000 + pasarela (sin SMS).

| Escenario | Ingreso | Costo aprox | **Margen** | % |
|---|---|---|---|---|
| Plus lista 89.900 | 89.900 | ~13.900 | **~76.000** | 85% |
| Plus promo 49.900 | 49.900 | ~12.700 | **~37.200** | 75% |
| Plus promo −50% 24.950 | 24.950 | ~11.950 | **~13.000** | 52% |
| Micropago 10.000 | 10.000 | ~7.500 | **~2.500** | 25% |

### Sensibilidad a la firma certificada (lo más incierto)

| Escenario | Firma 3.000 | Firma 6.000 | Firma 12.000 |
|---|---|---|---|
| Plus lista 89.900 | +79.000 | +76.000 | +70.000 |
| Plus promo 49.900 | +40.200 | +37.200 | +31.200 |
| Plus promo −50% 24.950 | +16.000 | +13.000 | **+7.000** |
| Micropago 10.000 | +5.500 | +2.500 | **−3.500 (pérdida)** |

## 4. Puntos de equilibrio (break-even)

- **Micropago $10.000:** pierde dinero si la **firma certificada cuesta más de ~$8.500 COP (~$2 USD)**. Es el producto más delgado.
- **Plus con −50% ($24.950):** aguanta hasta una firma de **~$19.000 COP (~$4.75 USD)** antes de perder.
- **Plus a precio promo/lista:** sano en todos los escenarios (60–85%).

## 5. Lecturas

1. **Los planes de pago a precio completo son muy rentables** (60–85%). No hay problema ahí.
2. **El −50% por referido es generoso pero seguro**, salvo que la firma certificada sea cara (> ~$19k). El admin puede mover el %; conviene un **piso**.
3. **El micropago de $10.000 es el único estructuralmente riesgoso**: solo funciona si la firma certificada es barata (≤ ~$8.500). Si Firma.dev cobra más, **subir el micropago a $15.000–20.000** o que el micropago desbloquee solo extras de costo casi-cero (no la certificada).
4. **La firma certificada es costo por uso**, no por contrato: la mayoría de los Plus que usen la **interna** casi no cuestan → el margen real probablemente sea **mejor** que la tabla.
5. **Recurrencia 1/año:** el margen por contrato ≈ contribución anual. Con CAC ~0 (referidos), incluso el caso delgado aporta. Las **comisiones de aliados** (un seguro = $20–80k) subsidian de sobra los casos delgados.

## 6. Reglas/guardas sugeridas

- **Piso de precio:** precio-neto-tras-descuento ≥ (costo firma certificada × ~2) + pasarela. Evita regalar margen.
- **Micropago:** fijarlo **después** de confirmar el costo de Firma.dev. Si la firma ≥ ~$2 USD, subirlo a ~$15–20k.
- **Tope al descuento:** que el % de referido no baje el neto por debajo del piso.
- **Apóyate en aliados + ads** para los casos delgados; ahí está la rentabilidad blendada.
- **Confirmar:** costo Firma.dev por firma/documento y comisión exacta de Wompi (con IVA). Con esos dos datos, esta tabla se vuelve definitiva.
