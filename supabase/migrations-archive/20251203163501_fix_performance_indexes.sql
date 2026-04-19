CREATE INDEX IF NOT EXISTS idx_inventory_alerts_variant_id ON public.inventory_alerts(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_variant_id ON public.inventory_snapshots(variant_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_merchant_id ON public.newsletter_subscribers(merchant_id);
