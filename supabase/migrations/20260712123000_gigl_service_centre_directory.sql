CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.shipping_provider_service_centres (
  provider text NOT NULL,
  station_id integer NOT NULL,
  station_name text NOT NULL,
  station_code text,
  service_centre_id integer NOT NULL,
  service_centre_name text NOT NULL,
  service_centre_code text,
  address text,
  location extensions.geography(Point, 4326),
  is_active boolean NOT NULL DEFAULT true,
  sync_generation uuid NOT NULL,
  source_synced_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, service_centre_id),
  CONSTRAINT shipping_provider_service_centres_provider_check
    CHECK (provider = upper(provider) AND provider <> '')
);

ALTER TABLE public.shipping_provider_service_centres ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shipping_provider_service_centres FROM anon, authenticated;
GRANT ALL ON public.shipping_provider_service_centres TO service_role;

CREATE POLICY shipping_provider_service_centres_service_role_all
  ON public.shipping_provider_service_centres
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS shipping_provider_service_centres_nearest_idx
  ON public.shipping_provider_service_centres USING gist (location)
  WHERE is_active AND location IS NOT NULL;

CREATE OR REPLACE FUNCTION public.replace_shipping_provider_service_centres(
  p_provider text,
  p_generation uuid,
  p_synced_at timestamptz,
  p_centres jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider text := upper(trim(p_provider));
  v_count integer;
  v_usable_location_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)
  INTO v_usable_location_count
  FROM jsonb_to_recordset(p_centres) AS x(
    latitude double precision,
    longitude double precision
  )
  WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180;

  IF v_usable_location_count = 0 THEN
    RAISE EXCEPTION 'snapshot contained no usable service-centre coordinates'
      USING ERRCODE = '22023';
  END IF;
  IF v_provider = '' OR p_generation IS NULL OR p_synced_at IS NULL
     OR jsonb_typeof(p_centres) <> 'array' OR jsonb_array_length(p_centres) = 0 THEN
    RAISE EXCEPTION 'invalid or empty service-centre snapshot' USING ERRCODE = '22023';
  END IF;

  WITH parsed AS (
    SELECT * FROM jsonb_to_recordset(p_centres) AS x(
      station_id integer, station_name text, station_code text,
      service_centre_id integer, service_centre_name text,
      service_centre_code text, address text, latitude double precision,
      longitude double precision
    )
  )
  INSERT INTO public.shipping_provider_service_centres (
    provider, station_id, station_name, station_code, service_centre_id,
    service_centre_name, service_centre_code, address, location, is_active,
    sync_generation, source_synced_at, updated_at
  )
  SELECT v_provider, station_id, station_name, station_code, service_centre_id,
    service_centre_name, service_centre_code, address,
    CASE WHEN latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
      THEN extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
      ELSE NULL END,
    true, p_generation, p_synced_at, now()
  FROM parsed
  WHERE station_id IS NOT NULL AND service_centre_id IS NOT NULL
    AND nullif(trim(station_name), '') IS NOT NULL
    AND nullif(trim(service_centre_name), '') IS NOT NULL
  ON CONFLICT (provider, service_centre_id) DO UPDATE SET
    station_id = excluded.station_id, station_name = excluded.station_name,
    station_code = excluded.station_code, service_centre_name = excluded.service_centre_name,
    service_centre_code = excluded.service_centre_code, address = excluded.address,
    location = coalesce(
      excluded.location,
      shipping_provider_service_centres.location
    ), is_active = true,
    sync_generation = excluded.sync_generation, source_synced_at = excluded.source_synced_at,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'snapshot contained no valid service centres' USING ERRCODE = '22023';
  END IF;

  UPDATE public.shipping_provider_service_centres
  SET is_active = false, updated_at = now()
  WHERE provider = v_provider AND sync_generation <> p_generation AND is_active;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_shipping_provider_service_centres(text, uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_shipping_provider_service_centres(text, uuid, timestamptz, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.find_nearest_shipping_service_centres(
  p_provider text,
  p_latitude double precision,
  p_longitude double precision,
  p_limit integer DEFAULT 3
) RETURNS TABLE (
  station_id integer, station_name text, station_code text,
  service_centre_id integer, service_centre_name text,
  service_centre_code text, address text, latitude double precision,
  longitude double precision, distance_metres double precision,
  source_synced_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.station_id, c.station_name, c.station_code, c.service_centre_id,
    c.service_centre_name, c.service_centre_code, c.address,
    extensions.st_y(c.location::extensions.geometry),
    extensions.st_x(c.location::extensions.geometry),
    extensions.st_distance(
      c.location,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
    ), c.source_synced_at
  FROM public.shipping_provider_service_centres c
  WHERE c.provider = upper(trim(p_provider)) AND c.is_active AND c.location IS NOT NULL
    AND p_latitude BETWEEN -90 AND 90 AND p_longitude BETWEEN -180 AND 180
  ORDER BY c.location OPERATOR(extensions.<->)
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
  LIMIT least(greatest(coalesce(p_limit, 3), 1), 10);
$$;

REVOKE ALL ON FUNCTION public.find_nearest_shipping_service_centres(text, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_nearest_shipping_service_centres(text, double precision, double precision, integer) TO anon, authenticated, service_role;
