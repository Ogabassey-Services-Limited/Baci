-- OAuth Handoff Tickets for mobile-to-web auth flow
-- Allows mobile apps to securely initiate Jumia OAuth in a browser
-- without requiring browser-side Supabase session cookies.
--
-- Lifecycle: pending → redeemed (by /connect) → exchanged (by /exchange)

CREATE TABLE IF NOT EXISTS oauth_handoff_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'redeemed', 'exchanged', 'expired')),
  oauth_state TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  exchanged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_tickets_lookup
  ON oauth_handoff_tickets (id, status, expires_at);

ALTER TABLE oauth_handoff_tickets ENABLE ROW LEVEL SECURITY;
-- Service-role only. No user-facing RLS policies needed.

-- Cleanup function: remove tickets older than 1 day
CREATE OR REPLACE FUNCTION cleanup_old_oauth_handoff_tickets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM oauth_handoff_tickets
  WHERE created_at < now() - interval '1 day';
END;
$$;
