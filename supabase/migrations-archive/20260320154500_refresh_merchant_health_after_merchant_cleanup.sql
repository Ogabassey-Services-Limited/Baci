-- Refresh merchant_health after removing placeholder customer merchants.
-- This keeps admin analytics in sync immediately on existing environments.

REFRESH MATERIALIZED VIEW CONCURRENTLY public.merchant_health;
