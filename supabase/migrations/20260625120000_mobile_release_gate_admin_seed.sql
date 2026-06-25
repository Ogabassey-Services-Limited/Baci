-- Seed the admin app's in-app update gate row. The mobile_release_gate table
-- (created in 20260624203337_mobile_release_gate.sql) is keyed per (app,
-- platform); the storefront iOS row was seeded there. This adds the admin iOS
-- row so the gate has a value before the first App Store Connect webhook /
-- reconciler run.
--
-- 273 = the CFBundleVersion currently live on the App Store for
-- com.ogabassey.baci (marketing version 2.0.273). The live-build reconciler
-- keeps it current after this; ON CONFLICT DO NOTHING so a re-run never
-- clobbers a reconciled value.

INSERT INTO public.mobile_release_gate (app, platform, latest_live_build, source)
VALUES ('admin', 'ios', 273, 'seed')
ON CONFLICT (app, platform) DO NOTHING;
