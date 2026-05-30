-- The storefront quiz event API reads these two fields to enforce the
-- production prize/compliance guard. Keep the broader event row hidden behind
-- the existing authenticated customer RLS policy.

GRANT SELECT (nlrc_permit_ref, compliance_verified)
  ON public.quiz_events TO authenticated;
