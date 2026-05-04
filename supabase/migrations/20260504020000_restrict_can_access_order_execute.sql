-- Restrict EXECUTE on can_access_order to authenticated and anon roles only.
-- SECURITY DEFINER functions should not be callable by PUBLIC (which includes
-- all roles), as this widens the attack surface beyond what is necessary.
REVOKE EXECUTE ON FUNCTION public.can_access_order(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_access_order(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_order(uuid, uuid) TO anon;
