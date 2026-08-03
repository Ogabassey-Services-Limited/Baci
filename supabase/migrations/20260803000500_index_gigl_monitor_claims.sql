-- Match the due-monitor claim predicate so paused monitors remain index-backed.

CREATE INDEX IF NOT EXISTS shipment_tracking_monitors_claimable_due_idx
  ON public.shipment_tracking_monitors (next_poll_at)
  WHERE state IN ('active', 'final_poll', 'paused')
    AND next_poll_at IS NOT NULL;
