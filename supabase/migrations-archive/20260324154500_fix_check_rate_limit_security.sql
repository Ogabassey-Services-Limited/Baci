CREATE OR REPLACE FUNCTION public.check_rate_limit(
  identifier_param TEXT,
  endpoint_param TEXT,
  max_requests INTEGER DEFAULT 100,
  window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_count INTEGER;
  window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  IF identifier_param IS NULL OR endpoint_param IS NULL THEN
    RAISE EXCEPTION 'identifier and endpoint cannot be null';
  END IF;

  IF max_requests <= 0 OR window_minutes <= 0 THEN
    RAISE EXCEPTION 'max_requests and window_minutes must be positive';
  END IF;

  window_start_time := clock_timestamp() - (window_minutes || ' minutes')::INTERVAL;

  SELECT COALESCE(SUM(request_count), 0) INTO current_count
  FROM public.rate_limit_log
  WHERE identifier = identifier_param
    AND endpoint = endpoint_param
    AND window_start > window_start_time;

  IF current_count >= max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_log (
    identifier,
    endpoint,
    request_count,
    window_start
  )
  VALUES (identifier_param, endpoint_param, 1, clock_timestamp())
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET
    request_count = public.rate_limit_log.request_count + 1,
    updated_at = clock_timestamp();

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
