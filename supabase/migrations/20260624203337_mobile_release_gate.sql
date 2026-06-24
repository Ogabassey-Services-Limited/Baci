-- Mobile storefront in-app "update available" gate, backed by the store's
-- actual live build number instead of a Vercel env var.
--
-- Why a table: the env-var gate (MOBILE_STOREFRONT_<P>_LATEST_BUILD) is
-- snapshotted by Vercel at deploy time, so the prompt only reflects a new build
-- after the next web deploy, and it was bumped on TestFlight upload — well
-- before Apple actually made the build downloadable. This row is written by the
-- `ios-live-build-sync` cron (App Store Connect API, READY_FOR_SALE only) and
-- read by the release-policy route at request time, so the prompt fires exactly
-- when the store is live, with no redeploy required.

CREATE TABLE IF NOT EXISTS public.mobile_release_gate (
  platform text NOT NULL,
  app text NOT NULL DEFAULT 'storefront',
  latest_live_build integer NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT mobile_release_gate_pkey PRIMARY KEY (app, platform),
  CONSTRAINT mobile_release_gate_platform_check CHECK (platform IN ('ios', 'android')),
  CONSTRAINT mobile_release_gate_build_nonneg CHECK (latest_live_build >= 0)
);

COMMENT ON TABLE public.mobile_release_gate IS
  'Latest build number actually live on each app store, per (app, platform). Written by the ios-live-build-sync cron; read by the release-policy route to gate the in-app update prompt.';

ALTER TABLE public.mobile_release_gate ENABLE ROW LEVEL SECURITY;

-- The latest live build is public, non-sensitive information already shown in
-- every app's "update available" prompt, so anonymous read is intentional.
DROP POLICY IF EXISTS mobile_release_gate_public_read ON public.mobile_release_gate;
CREATE POLICY mobile_release_gate_public_read
  ON public.mobile_release_gate
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only the cron reconciler (service role) writes the live build number.
DROP POLICY IF EXISTS mobile_release_gate_service_role_all ON public.mobile_release_gate;
CREATE POLICY mobile_release_gate_service_role_all
  ON public.mobile_release_gate
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.mobile_release_gate FROM anon, authenticated;
GRANT SELECT ON TABLE public.mobile_release_gate TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mobile_release_gate TO service_role;

-- Seed the iOS row with the build currently live on the App Store (marketing
-- version 2.1.360 => CFBundleVersion 360). The cron reconciles this on its next
-- run; seeding stops the false "update available" prompt the moment this deploys
-- (the prior env value had raced ahead to 390+ on TestFlight uploads).
INSERT INTO public.mobile_release_gate (app, platform, latest_live_build, source)
VALUES ('storefront', 'ios', 360, 'seed')
ON CONFLICT (app, platform) DO NOTHING;
