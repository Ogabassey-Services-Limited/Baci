-- Stop duplicate staff invite emails.
--
-- Staff invite emails are sent by the web/API path through the app's
-- ZeptoMail wrapper. The legacy database trigger also enqueued the
-- send-staff-invite Edge Function on every invitation_token write, causing a
-- second ZeptoMail message from noreply@usebaci.com for the same token.

DROP TRIGGER IF EXISTS on_staff_invite ON public.staff_members;

COMMENT ON FUNCTION public.handle_new_staff_invite() IS
  'Legacy staff invite Edge Function enqueue path disabled by dropping on_staff_invite; web/API sends staff invite email via ZeptoMail.';
