COMMENT ON FUNCTION public.mark_abandoned_orders(integer) IS
  'Marks stale unpaid orders and stale Credit Direct BNPL checkout sessions as cancelled. Threshold must be 1-720 hours.';

REVOKE ALL ON FUNCTION public.mark_abandoned_orders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_orders(integer) TO service_role;
