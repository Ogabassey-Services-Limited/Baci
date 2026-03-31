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
  caller_identifier TEXT := auth.uid()::TEXT;
  rate_limit_identifier TEXT;
  rate_limit_key TEXT;
  current_count INTEGER;
  current_time TIMESTAMP WITH TIME ZONE := clock_timestamp();
  current_window TIMESTAMP WITH TIME ZONE := date_trunc('second', current_time);
  window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  rate_limit_identifier := COALESCE(caller_identifier, identifier_param);

  IF rate_limit_identifier IS NULL OR endpoint_param IS NULL THEN
    RETURN FALSE;
  END IF;

  IF max_requests IS NULL OR window_minutes IS NULL THEN
    RETURN FALSE;
  END IF;

  IF max_requests <= 0 OR window_minutes <= 0 THEN
    RETURN FALSE;
  END IF;

  rate_limit_key :=
    COALESCE(rate_limit_identifier, '') || ':' || COALESCE(endpoint_param, '');
  window_start_time := current_time - make_interval(mins => window_minutes);

  PERFORM pg_advisory_xact_lock(hashtextextended(rate_limit_key, 0));

  SELECT COALESCE(SUM(request_count), 0) INTO current_count
  FROM public.rate_limit_log
  WHERE identifier = rate_limit_identifier
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
  VALUES (rate_limit_identifier, endpoint_param, 1, current_window)
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
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
