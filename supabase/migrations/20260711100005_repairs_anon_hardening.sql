-- Harden the repairs bookings table now that writes go through the booking RPC.
--
-- Ordering matters: this runs AFTER the booking RPC so anonymous bookings never
-- break. Anon interacts with repairs only via public.create_repair_booking.
--
-- Merchant SELECT/UPDATE/DELETE stay on the baseline owner-scoped policies here;
-- moving them onto check_staff_permission('repairs', ...) lands with the
-- role_permissions seeding in the dashboard phase.

REVOKE ALL ON TABLE public.repairs FROM anon;
REVOKE ALL ON SEQUENCE public.repairs_ticket_number_seq FROM anon;

DROP POLICY IF EXISTS "Public can create repair requests" ON public.repairs;
