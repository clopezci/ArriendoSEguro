-- ═══════════════════════════════════════════════════════════════════
-- Migration 018 — Wompi integration (Colombia payment gateway)
-- ═══════════════════════════════════════════════════════════════════
-- Esta app actúa como HUB temporal de webhooks Wompi para múltiples
-- apps del mismo comercio LOTIC Soluciones. Cuando arriendoseguro.app
-- esté en producción (~1 mes), el hub migrará allá.
--
-- Ver WOMPI_INTEGRATION.md para arquitectura completa y guía de
-- migración del hub.
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. Tabla payment_events_wompi: audit log de eventos recibidos
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_events_wompi (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- transaction id de Wompi (txn_xxx)
  wompi_txn_id    TEXT NOT NULL,
  -- reference que pusimos al crear la transacción (ej. swap_premium_<uid>_<ts>)
  reference       TEXT NOT NULL,
  -- prefijo de app extraído del reference (swap, transfdig, arriendo...)
  app_prefix      TEXT,
  -- evento type de Wompi: transaction.updated, etc.
  event_type      TEXT NOT NULL,
  -- estado de la transacción: APPROVED, DECLINED, VOIDED, ERROR
  status          TEXT NOT NULL,
  -- monto en centavos COP
  amount_cents    BIGINT,
  currency        TEXT DEFAULT 'COP',
  -- payload completo del evento (para debug)
  raw_payload     JSONB NOT NULL,
  -- 'processed' si lo procesó esta app, 'forwarded' si lo reenvió a otra app
  outcome         TEXT NOT NULL CHECK (outcome IN ('processed', 'forwarded', 'rejected', 'unknown')),
  -- mensaje informativo del outcome
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_wompi_reference ON public.payment_events_wompi (reference);
CREATE INDEX idx_payment_events_wompi_txn ON public.payment_events_wompi (wompi_txn_id);
CREATE INDEX idx_payment_events_wompi_created_at ON public.payment_events_wompi (created_at DESC);

ALTER TABLE public.payment_events_wompi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read wompi events"
  ON public.payment_events_wompi FOR SELECT
  USING (public.auth_is_admin());

-- Inserts solo desde server (service_role), nunca desde cliente


-- ─────────────────────────────────────────────────────────────────
-- 2. Settings nuevos en app_settings (precio COP + URLs forward)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description) VALUES
  ('premium_price_cop',
   '1090000'::jsonb,
   'Precio en centavos COP del Premium ($10.900 COP). Wompi opera en centavos: 10900 COP = 1090000 centavos.'),
  ('wompi_forward_transfdig_url',
   '"https://transformacion-digital-two.vercel.app/api/wompi/webhook"'::jsonb,
   'URL donde reenviar eventos Wompi cuyo reference empieza con "transfdig_". Cuando la otra app esté en producción y use Wompi, este URL recibe sus eventos.')
ON CONFLICT (key) DO NOTHING;
