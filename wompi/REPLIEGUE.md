# Guía de repliegue — apagar AppStickers al final de la temporada

> **Objetivo:** dejar de pagar servidores **de esta app** (AppStickers) cuando
> termine la temporada (Mundial + 2 meses), **sin afectar tus otras apps** y
> **sin romper los pagos por Wompi** de las demás apps que dependen del hub que
> vive aquí.

> ⚠️ **REGLA DE ORO:** El **webhook hub de Wompi vive dentro de AppStickers**.
> Si apagas AppStickers ANTES de migrar el hub, tus otras apps dejan de recibir
> confirmaciones de pago de Wompi. **Primero migras el hub, después apagas.**

---

## 0. Antes de empezar: qué te cobra y qué es "solo de esta app"

| Servicio | ¿Cómo se cobra? | ¿Apagarlo afecta otras apps? | Acción para AppStickers |
|---|---|---|---|
| **Supabase** (~$25/mes) | **Por proyecto.** AppStickers tiene su PROPIO proyecto Supabase. | ❌ No — cada app tiene su proyecto aparte. | **Pausar y luego borrar SOLO el proyecto de AppStickers.** Aquí está el ahorro principal y es 100% por-app. |
| **Vercel** (~$20/mes Pro) | **Por cuenta/equipo**, no por proyecto. | ⚠️ Sí, si tienes otras apps en la MISMA cuenta Vercel Pro. | No bajes el plan si otras apps lo necesitan. Solo **borra el proyecto AppStickers** (libera recursos; la mensualidad Pro sigue mientras otra app la necesite). Si AppStickers era lo ÚNICO que requería Pro → baja a Hobby (gratis). |
| **Dominio** `appstickers.app` | Anual | ❌ No | Déjalo expirar (no renovar) o apúntalo a una landing estática. |
| **Resend** (correo) | Free tier | ❌ No | Nada que pagar. |
| **Paddle / Wompi** | Comisión por venta, $0 fijo | ❌ No | Desactivar el producto para que no entren ventas nuevas (paso 4). |

**Conclusión:** el costo que de verdad bajas "solo para esta app" es **Supabase
(~$25/mes)** borrando su proyecto. Vercel Pro solo lo bajas si AppStickers era
la única app que lo justificaba.

---

## FASE 1 — Migrar el webhook hub de Wompi a arriendoseguro (OBLIGATORIO primero)

Esto está documentado en detalle en **`WOMPI_INTEGRATION.md` → "Cómo migrar el
hub a otra app"**. Resumen accionable:

1. **Copia el módulo Wompi** a arriendoseguro (es portable, autocontenido):
   `src/lib/wompi/*`, `src/app/api/wompi/*`, `src/app/api/geo/country/route.ts`,
   `src/app/payment/wompi/return/*`.
2. En arriendoseguro, en `src/lib/wompi/reference.ts` cambia
   `APP_PREFIX = 'arriendo'`.
3. Adapta `processOurOwn` del webhook al modelo de arriendoseguro (lo que active
   un pago allá). El enrutamiento a otras apps por prefijo se queda igual.
4. En el **Supabase de arriendoseguro**, crea `app_settings` (mig 017) y siembra
   los forwards de las apps que sigan vivas. **Incluye SwapStickers solo si va a
   seguir activa**; si la vas a apagar, NO la incluyas:
   ```sql
   INSERT INTO public.app_settings (key, value, description) VALUES
     ('wompi_forward_transfdig_url',
      '"https://transformacion-digital-two.vercel.app/api/wompi/webhook"'::jsonb,
      'Forward de eventos transfdig_*');
   -- (NO agregar wompi_forward_swap_url si AppStickers se va a apagar)
   ```
5. Copia las **6 variables de entorno Wompi** a Vercel de arriendoseguro.
6. **Wompi Dashboard → Programadores → URL de Eventos:** cámbiala de
   `https://appstickers.app/api/wompi/webhook` a
   `https://arriendoseguro.app/api/wompi/webhook`.
7. **Verifica** con una transacción sandbox que arriendoseguro recibe y enruta
   bien (revisa su tabla `payment_events_wompi`). **No avances hasta confirmar.**

> Tiempo estimado: ~30 min. Mientras no cambies la URL en Wompi (paso 6), el hub
> sigue funcionando en AppStickers — puedes preparar todo con calma.

---

## FASE 2 — Avisar a los usuarios (lo exige nuestra T&C)

Los Términos (sección 8) dicen que avisaremos "con antelación razonable" antes
de descontinuar la nube. Recomendado **2–4 semanas antes**:

- Banner/aviso in-app: "AppStickers cerrará sus servicios en línea el [fecha].
  Tu álbum seguirá funcionando en tu dispositivo. Exporta tu lista desde
  Perfil."
- (Opcional) correo vía Resend a los usuarios con cuenta.

> Recordatorio: el álbum es **local-first** (vive en el dispositivo, IndexedDB),
> así que nadie pierde sus láminas al apagar la nube. Solo se pierden las
> funciones en línea (matches, grupos, Gold Match, sync entre dispositivos).

---

## FASE 3 — Cortar lo que genera trabajo/costo en segundo plano

1. **Detener el cron del match engine** (Supabase SQL Editor):
   ```sql
   SELECT cron.unschedule('match-engine-cron');
   ```
   (Si no, seguirá llamando a Vercel cada 10 min hasta que borres el proyecto.)
2. **Desactivar ventas nuevas:**
   - Paddle Dashboard → el producto Premium → archivar/desactivar el precio.
   - (Wompi no tiene "producto" propio; al apagar el endpoint de pago de
     AppStickers ya no se generan transacciones nuevas para `swap_`.)

---

## FASE 4 — Apagar AppStickers

> Hazlo **solo después** de confirmar la FASE 1 (hub migrado y verificado).

1. **Supabase (el ahorro real, ~$25/mes):**
   - Primero **pausar** el proyecto de AppStickers (Project Settings → General →
     Pause). Déjalo pausado unas semanas como red de seguridad.
   - Cuando estés seguro, **borrar** el proyecto (Settings → General → Delete
     project). Esto detiene definitivamente el cobro de ESE proyecto.
   - ⚠️ Confirma que es el proyecto de AppStickers y no el de otra app.
2. **Vercel:**
   - Si tienes otras apps en la misma cuenta Pro → **borra solo el proyecto
     AppStickers** (Project → Settings → Delete). La mensualidad Pro sigue por
     las otras apps.
   - Si AppStickers era lo único que exigía Pro → además **baja el plan a
     Hobby** (Account/Team → Settings → Billing → Downgrade).
3. **Dominio `appstickers.app`:** no renovar, o apuntarlo a una página estática
   simple ("App de temporada finalizada, gracias").
4. **Wompi:** confirma que la URL de eventos ya apunta a arriendoseguro (FASE 1,
   paso 6). No queda nada apuntando a AppStickers.

---

## Checklist rápido

- [ ] Hub Wompi copiado y adaptado en arriendoseguro
- [ ] URL de eventos en Wompi Dashboard → arriendoseguro
- [ ] Transacción sandbox verificada en arriendoseguro
- [ ] Aviso a usuarios publicado (2–4 semanas antes)
- [ ] `cron.unschedule('match-engine-cron')` ejecutado
- [ ] Producto Premium de Paddle desactivado
- [ ] Proyecto Supabase de AppStickers **pausado** → (luego) **borrado**
- [ ] Proyecto Vercel de AppStickers borrado (y plan ajustado si aplica)
- [ ] Dominio no renovado / redirigido

---

## Si en vez de apagar quieres "modo mínimo" (mantener la nube barata)

Alternativa a borrar todo: dejar la app viva pero baratísima.
- Supabase tiene un tier **Free** (con el proyecto en uso ligero). Si el tráfico
  es bajo, podrías bajar de Pro a Free en lugar de borrar — conservas datos y
  sync. (Ojo con límites de Free: pausa por inactividad, almacenamiento.)
- Vercel Hobby es gratis pero **no permite uso comercial**; si la app ya no
  vende Premium y es solo personal/comunidad, podría encajar.

Esto es útil si quieres conservar la comunidad sin pagar Pro, en vez de cerrar.
