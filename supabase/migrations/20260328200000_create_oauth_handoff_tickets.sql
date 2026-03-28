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

-- Covers UPDATE ... WHERE status = ? AND expires_at > now() lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tickets_status_expires
  ON oauth_handoff_tickets (status, expires_at);

-- Covers cleanup_old_oauth_handoff_tickets() WHERE created_at < threshold
CREATE INDEX IF NOT EXISTS idx_oauth_tickets_created_at
  ON oauth_handoff_tickets (created_at);

-- Ensure each non-null oauth_state is unique (prevents state reuse attacks)
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tickets_state_unique
  ON oauth_handoff_tickets (oauth_state) WHERE oauth_state IS NOT NULL;

-- FK indexes for efficient CASCADE deletes
CREATE INDEX IF NOT EXISTS idx_oauth_tickets_merchant_id
  ON oauth_handoff_tickets (merchant_id);

CREATE INDEX IF NOT EXISTS idx_oauth_tickets_user_id
  ON oauth_handoff_tickets (user_id);

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
