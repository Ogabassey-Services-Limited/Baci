-- Migration: Add missing foreign key indexes
-- Date: 2026-02-21
-- Description:
--   Create FK indexes in a transaction-safe migration for Supabase CLI compatibility.

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_id
    ON public.reward_redemptions(reward_id)
    WHERE reward_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_negotiation_customer
    ON public.negotiation_requests(customer_id)
    WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jumia_product_mappings_variant
    ON public.jumia_product_mappings(variant_id)
    WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jumia_orders_baci_order_id
    ON public.jumia_orders(baci_order_id)
    WHERE baci_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_webhook_shipment_id
    ON public.shipping_webhook_events(shipment_id)
    WHERE shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shipment_id
    ON public.orders(shipment_id)
    WHERE shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_selected_quote_id
    ON public.orders(selected_quote_id)
    WHERE selected_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_order_id
    ON public.reward_redemptions(used_on_order_id)
    WHERE used_on_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_variant_inventory_order_id
    ON public.variant_inventory(order_id)
    WHERE order_id IS NOT NULL;
