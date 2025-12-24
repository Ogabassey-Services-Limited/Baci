-- Santa Campaign Analytics: Track interactions with Santa AI chatbot
-- This enables campaign reporting for the Christmas promotion

-- Create santa_interactions table
CREATE TABLE IF NOT EXISTS public.santa_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- Tracks unique chat sessions (derived from IP or fingerprint)
  client_ip TEXT, -- Hashed IP for rate limiting correlation

  -- Interaction details
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('chat', 'wish_granted', 'wish_denied', 'add_to_cart', 'checkout_started', 'checkout_completed')),
  product_name TEXT, -- Product mentioned in the wish
  requested_price NUMERIC(12,2), -- Budget the user mentioned
  approved_price NUMERIC(12,2), -- Price Santa approved (if granted)
  discount_percentage NUMERIC(5,2), -- Calculated discount percentage

  -- Message context
  user_message TEXT, -- The user's message (sanitized)
  santa_response TEXT, -- Santa's response (truncated for storage)

  -- Conversion tracking
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, -- If converted to sale

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_santa_interactions_merchant_id ON public.santa_interactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_santa_interactions_session_id ON public.santa_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_santa_interactions_type ON public.santa_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_santa_interactions_created_at ON public.santa_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_santa_interactions_product ON public.santa_interactions(product_name) WHERE product_name IS NOT NULL;

-- RLS Policies
ALTER TABLE public.santa_interactions ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own interactions
CREATE POLICY "Merchants can view their santa interactions"
  ON public.santa_interactions
  FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
    OR
    merchant_id IN (
      SELECT merchant_id FROM public.staff_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Service role can insert (for the API route)
CREATE POLICY "Service role can insert santa interactions"
  ON public.santa_interactions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.santa_interactions TO authenticated;
GRANT INSERT ON public.santa_interactions TO service_role;

-- Create a view for campaign analytics
CREATE OR REPLACE VIEW public.santa_campaign_stats AS
SELECT
  merchant_id,
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE interaction_type = 'chat') as total_chats,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(*) FILTER (WHERE interaction_type = 'wish_granted') as wishes_granted,
  COUNT(*) FILTER (WHERE interaction_type = 'wish_denied') as wishes_denied,
  COUNT(*) FILTER (WHERE interaction_type = 'add_to_cart') as added_to_cart,
  COUNT(*) FILTER (WHERE interaction_type = 'checkout_completed') as conversions,
  AVG(discount_percentage) FILTER (WHERE discount_percentage IS NOT NULL) as avg_discount,
  SUM(approved_price) FILTER (WHERE interaction_type = 'checkout_completed') as total_revenue
FROM public.santa_interactions
GROUP BY merchant_id, DATE(created_at);

-- Grant access to the view
GRANT SELECT ON public.santa_campaign_stats TO authenticated;

COMMENT ON TABLE public.santa_interactions IS 'Tracks Santa AI chatbot interactions for campaign analytics';
COMMENT ON VIEW public.santa_campaign_stats IS 'Aggregated daily stats for Santa campaign reporting';
