-- Production denies anonymous SELECT on this secret-bearing settings table,
-- while the historical baseline still grants it. Reconcile fresh/replayed
-- databases with production and keep storefront reads on the allowlisted
-- SECURITY DEFINER projections instead of exposing the base table.

DROP POLICY IF EXISTS "Public can read published merchant feature settings"
  ON public.merchant_feature_settings;

REVOKE SELECT ON TABLE public.merchant_feature_settings FROM PUBLIC, anon;

ALTER POLICY "Unified view access for feature settings"
  ON public.merchant_feature_settings
  TO authenticated;
