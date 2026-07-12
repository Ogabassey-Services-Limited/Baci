-- ============================================================================
-- PROTOTYPE (ADR B0) — NOT A LIVE MIGRATION. Do not place in supabase/migrations/
-- or apply until B0 is signed and the workaround-retirement non-security gate opens.
-- Realizes ADR B0 §D3. Generalizes the payment_side_effects claim/lease ledger
-- (migration 20260510120000) to an entity-agnostic, generation-aware invalidation
-- outbox. Unverified draft for review.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cache_invalidation_outbox (
  merchant_id          uuid        NOT NULL,
  target_kind          text        NOT NULL
    CHECK (target_kind IN (
      'product_cache', 'category_listing', 'storefront_document',
      'sitemap', 'merchant_feed'
    )),
  target_id            text        NOT NULL,           -- slug / id / path key
  generation           bigint      NOT NULL DEFAULT 1, -- bumped on every enqueue
  status               text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'completed', 'failed')),
  claim_token          uuid,
  claimed_generation   bigint,
  claimed_by           text,
  claimed_at           timestamptz,
  completed_generation bigint,
  completed_at         timestamptz,
  attempts             int         NOT NULL DEFAULT 0,
  last_error           text,
  payload              jsonb       NOT NULL DEFAULT '{}'::jsonb, -- old/new slugs, paths, hostnames
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, target_kind, target_id)
);

-- The drainer's queue query: only rows that still need work.
CREATE INDEX IF NOT EXISTS cache_invalidation_outbox_open_idx
  ON public.cache_invalidation_outbox (status, claimed_at)
  WHERE status <> 'completed';

ALTER TABLE public.cache_invalidation_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cache_invalidation_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.cache_invalidation_outbox TO service_role;
CREATE POLICY cache_invalidation_outbox_service_all
  ON public.cache_invalidation_outbox FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ENQUEUE — call INSIDE the same transaction as the covered mutation (RPC or trigger).
-- Re-queues even a completed target (generation-aware: a later mutation is never
-- suppressed by an earlier completed purge).
CREATE OR REPLACE FUNCTION public.enqueue_cache_invalidation(
  p_merchant_id uuid, p_target_kind text, p_target_id text, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF auth.role() NOT IN ('service_role', 'postgres') THEN
    -- Callable only from service-role RPCs / triggers that run as definer; never from clients.
    RAISE EXCEPTION 'forbidden: enqueue_cache_invalidation is service-role only';
  END IF;
  INSERT INTO public.cache_invalidation_outbox
    (merchant_id, target_kind, target_id, generation, status, payload)
  VALUES (p_merchant_id, p_target_kind, p_target_id, 1, 'pending', COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (merchant_id, target_kind, target_id) DO UPDATE
    SET generation = public.cache_invalidation_outbox.generation + 1,
        status     = 'pending',
        payload    = COALESCE(EXCLUDED.payload, '{}'::jsonb),
        updated_at = now();
END;
$$;

-- CLAIM — service-role only; takes one pending/failed/stale-claimed row with a lease.
CREATE OR REPLACE FUNCTION public.claim_cache_invalidation(
  p_merchant_id uuid, p_target_kind text, p_target_id text,
  p_claim_token uuid, p_claimed_by text, p_lease_seconds int DEFAULT 30
) RETURNS TABLE(we_won boolean, claimed_generation bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_cache_invalidation is service-role only';
  END IF;
  UPDATE public.cache_invalidation_outbox o
     SET status             = 'claimed',
         claim_token        = p_claim_token,
         claimed_generation = o.generation,
         claimed_by         = p_claimed_by,
         claimed_at         = now(),
         attempts           = o.attempts + 1,
         updated_at         = now()
   WHERE o.merchant_id = p_merchant_id
     AND o.target_kind = p_target_kind
     AND o.target_id   = p_target_id
     AND (
          o.status = 'pending'
       OR o.status = 'failed'
       OR (o.status = 'claimed' AND o.claimed_at < now() - make_interval(secs => p_lease_seconds))
     );
  RETURN QUERY
    SELECT (o.claim_token = p_claim_token) AS we_won, o.claimed_generation
    FROM public.cache_invalidation_outbox o
    WHERE o.merchant_id = p_merchant_id AND o.target_kind = p_target_kind AND o.target_id = p_target_id;
END;
$$;

-- COMPLETE — generation-checked: if a newer mutation arrived during the drain
-- (generation advanced past the claimed generation), the row is NOT completed and
-- re-drains. Re-purging a tag/URL is idempotent, so a crash after purge/before
-- complete is safe.
CREATE OR REPLACE FUNCTION public.complete_cache_invalidation(
  p_merchant_id uuid, p_target_kind text, p_target_id text, p_claim_token uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_done boolean;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: complete_cache_invalidation is service-role only';
  END IF;
  UPDATE public.cache_invalidation_outbox o
     SET status               = 'completed',
         completed_generation = o.claimed_generation,
         completed_at         = now(),
         updated_at           = now()
   WHERE o.merchant_id = p_merchant_id AND o.target_kind = p_target_kind AND o.target_id = p_target_id
     AND o.claim_token = p_claim_token
     AND o.generation  = o.claimed_generation   -- no newer mutation arrived mid-drain
  RETURNING true INTO v_done;
  RETURN COALESCE(v_done, false);  -- false ⇒ generation advanced (or lost claim) ⇒ leave for re-drain
END;
$$;

REVOKE ALL ON FUNCTION
  public.enqueue_cache_invalidation(uuid, text, text, jsonb),
  public.claim_cache_invalidation(uuid, text, text, uuid, text, int),
  public.complete_cache_invalidation(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.claim_cache_invalidation(uuid, text, text, uuid, text, int),
  public.complete_cache_invalidation(uuid, text, text, uuid)
  TO service_role;
-- enqueue is invoked by other SECURITY DEFINER mutation RPCs/triggers, not granted to a client role.
