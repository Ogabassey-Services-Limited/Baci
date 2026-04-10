CREATE TABLE IF NOT EXISTS public.email_send_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL DEFAULT 'zeptomail',
  delivery_channel TEXT NOT NULL DEFAULT 'email',
  transport_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'failed')),
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  reply_to TEXT,
  subject TEXT,
  template_key TEXT,
  provider_message_id TEXT,
  provider_error_code TEXT,
  provider_error_message TEXT,
  provider_error_details JSONB,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_send_attempts_created_at
  ON public.email_send_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_send_attempts_recipient_email
  ON public.email_send_attempts (recipient_email);

CREATE INDEX IF NOT EXISTS idx_email_send_attempts_status
  ON public.email_send_attempts (status);

CREATE INDEX IF NOT EXISTS idx_email_send_attempts_order_id
  ON public.email_send_attempts (order_id);

CREATE INDEX IF NOT EXISTS idx_email_send_attempts_merchant_id
  ON public.email_send_attempts (merchant_id);

CREATE INDEX IF NOT EXISTS idx_email_send_attempts_customer_id
  ON public.email_send_attempts (customer_id);

ALTER TABLE public.email_send_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_send_attempts IS
  'Internal telemetry for outbound email attempts across the platform.';

COMMENT ON COLUMN public.email_send_attempts.transport_type IS
  'Logical send path used by the mail helper: html, template, or batch_template.';

COMMENT ON COLUMN public.email_send_attempts.status IS
  'pending before provider response, accepted after provider acknowledgement, failed on validation/provider/runtime error.';
