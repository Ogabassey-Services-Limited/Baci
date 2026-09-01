CREATE OR REPLACE FUNCTION public.bind_admin_gigl_quote(
  p_order_id uuid,
  p_merchant_id uuid,
  p_quote jsonb,
  p_receiver jsonb
)
RETURNS TABLE (quote jsonb, available_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_balance numeric := 0;
  v_quote_id uuid := (p_quote->>'id')::uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.merchants m WHERE m.id = p_merchant_id AND m.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND merchant_id = p_merchant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF v_order.shipment_id IS NOT NULL OR v_order.tracking_number IS NOT NULL OR lower(v_order.shipping_status) IN ('shipped','booked','in_transit') THEN
    RAISE EXCEPTION 'order_already_shipped_or_booked';
  END IF;
  IF p_quote->>'provider' <> 'GIGL' OR (p_quote->>'merchant_id')::uuid IS DISTINCT FROM p_merchant_id THEN RAISE EXCEPTION 'invalid_quote'; END IF;
  INSERT INTO public.shipping_quotes (id, merchant_id, session_id, provider, service_tier, carrier_name, price, provider_cost, platform_margin, platform_margin_bps, pricing_version, currency, estimated_days, min_days, max_days, pickup_included, insurance_included, is_station_pickup, station_name, station_address, provider_rate_id, provider_metadata, expires_at, quote_request)
  VALUES (v_quote_id, p_merchant_id, p_order_id::text, 'GIGL', p_quote->>'service_tier', p_quote->>'carrier_name', (p_quote->>'price')::numeric, NULLIF(p_quote->>'provider_cost','')::numeric, NULLIF(p_quote->>'platform_margin','')::numeric, NULLIF(p_quote->>'platform_margin_bps','')::integer, p_quote->>'pricing_version', COALESCE(p_quote->>'currency','NGN'), (p_quote->>'estimated_days')::integer, (p_quote->>'min_days')::integer, (p_quote->>'max_days')::integer, COALESCE((p_quote->>'pickup_included')::boolean,true), COALESCE((p_quote->>'insurance_included')::boolean,true), false, p_quote->>'station_name', p_quote->>'station_address', p_quote->>'provider_rate_id', p_quote->'provider_metadata', (p_quote->>'expires_at')::timestamptz, p_quote->'quote_request')
  ON CONFLICT (id) DO UPDATE SET price=EXCLUDED.price, provider_cost=EXCLUDED.provider_cost, platform_margin=EXCLUDED.platform_margin, platform_margin_bps=EXCLUDED.platform_margin_bps, pricing_version=EXCLUDED.pricing_version, expires_at=EXCLUDED.expires_at, quote_request=EXCLUDED.quote_request;
  SELECT COALESCE(w.available_balance,0) INTO v_balance FROM public.merchant_wallets w WHERE w.merchant_id = p_merchant_id;
  UPDATE public.orders SET selected_quote_id=v_quote_id, shipping_provider='GIGL', shipping_address=p_receiver, shipping_funding_source='merchant_wallet' WHERE id=p_order_id;
  RETURN QUERY SELECT to_jsonb(sq), v_balance FROM public.shipping_quotes sq WHERE sq.id=v_quote_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_admin_gigl_quote(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bind_admin_gigl_quote(uuid, uuid, jsonb, jsonb) TO authenticated;
