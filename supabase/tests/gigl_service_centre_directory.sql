BEGIN;

SELECT plan(6);

SELECT has_table('public', 'shipping_provider_service_centres');
SELECT has_policy(
  'public',
  'shipping_provider_service_centres',
  'shipping_provider_service_centres_service_role_all'
);
SELECT has_function('public', 'find_nearest_shipping_service_centres', ARRAY['text', 'double precision', 'double precision', 'integer']);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT is(
  public.replace_shipping_provider_service_centres(
    'GIGL', '00000000-0000-4000-8000-000000000001', now(),
    '[{"station_id":4,"station_name":"LAGOS","service_centre_id":65,"service_centre_name":"SANGO OTTA","latitude":6.7072759,"longitude":3.2432813},{"station_id":2,"station_name":"ABEOKUTA","service_centre_id":7,"service_centre_name":"ABEOKUTA","latitude":7.1475,"longitude":3.3619}]'::jsonb
  ),
  2,
  'service role atomically installs a provider snapshot'
);

SELECT throws_ok(
  $$SELECT public.replace_shipping_provider_service_centres(
    'GIGL', '00000000-0000-4000-8000-000000000002', now(),
    '[{"station_id":4,"station_name":"LAGOS","service_centre_id":65,"service_centre_name":"SANGO OTTA","latitude":null,"longitude":null}]'::jsonb
  )$$,
  '22023',
  'snapshot contained no usable service-centre coordinates',
  'a coordinate-less snapshot cannot replace the last-known-good directory'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);
SELECT is(
  (SELECT service_centre_id FROM public.find_nearest_shipping_service_centres('GIGL', 6.68, 3.27, 1)),
  65,
  'anonymous lookup chooses the geographically nearest centre'
);

SELECT * FROM finish();
ROLLBACK;
