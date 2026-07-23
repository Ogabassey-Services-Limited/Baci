-- Avoid materializing the wide analytics event set and then rescanning it for
-- search, view, and conversion metrics. Aggregate each event to narrow
-- per-product rows as it is read from the existing merchant/type/time index.

CREATE OR REPLACE FUNCTION public.get_website_performance_event_summary(
  p_merchant_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role text := COALESCE((SELECT auth.role()), '');
  v_most_searched jsonb;
  v_top_converting jsonb;
BEGIN
  IF p_merchant_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'website_performance_arguments_required'
      USING ERRCODE = '22023';
  END IF;

  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'invalid_website_performance_date_range'
      USING ERRCODE = '22023';
  END IF;

  IF p_end_date - p_start_date > interval '30 days' THEN
    RAISE EXCEPTION 'website_performance_date_range_too_large'
      USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.id = p_merchant_id
        AND merchant.user_id = (SELECT auth.uid())
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.staff_members AS staff
      LEFT JOIN public.role_permissions AS role_permissions
        ON role_permissions.role = staff.role
      WHERE staff.merchant_id = p_merchant_id
        AND staff.user_id = (SELECT auth.uid())
        AND staff.status = 'active'
        AND (
          COALESCE(
            (staff.permissions -> '*' ->> '*')::boolean,
            (role_permissions.permissions -> '*' ->> '*')::boolean,
            false
          )
          OR COALESCE(
            (staff.permissions -> '*' ->> 'view')::boolean,
            (role_permissions.permissions -> '*' ->> 'view')::boolean,
            false
          )
          OR COALESCE(
            (staff.permissions -> 'analytics' ->> '*')::boolean,
            (role_permissions.permissions -> 'analytics' ->> '*')::boolean,
            false
          )
          OR COALESCE(
            (staff.permissions -> 'analytics' ->> 'view')::boolean,
            (role_permissions.permissions -> 'analytics' ->> 'view')::boolean,
            false
          )
          OR COALESCE(
            (staff.permissions -> 'analytics' ->> 'all')::boolean,
            (role_permissions.permissions -> 'analytics' ->> 'all')::boolean,
            false
          )
          OR COALESCE(
            (staff.permissions -> 'full_access' ->> 'all')::boolean,
            (role_permissions.permissions -> 'full_access' ->> 'all')::boolean,
            false
          )
        )
    ) THEN
      RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'query', top_search.query,
    'count', top_search.search_count
  )
  INTO v_most_searched
  FROM (
    SELECT
      pg_catalog.lower(pg_catalog.btrim(COALESCE(
        event.event_data ->> 'search_term',
        event.event_data ->> 'query'
      ))) AS query,
      pg_catalog.count(*) AS search_count
    FROM public.analytics_events AS event
    WHERE event.merchant_id = p_merchant_id
      AND event.event_type = 'search'
      AND event.event_timestamp >= p_start_date
      AND event.event_timestamp <= p_end_date
      AND pg_catalog.btrim(COALESCE(
        event.event_data ->> 'search_term',
        event.event_data ->> 'query',
        ''
      )) <> ''
    GROUP BY pg_catalog.lower(pg_catalog.btrim(COALESCE(
      event.event_data ->> 'search_term',
      event.event_data ->> 'query'
    )))
    ORDER BY search_count DESC, query ASC
    LIMIT 1
  ) AS top_search;

  WITH product_activity AS (
    SELECT
      candidate.product_id,
      pg_catalog.max(candidate.product_name) FILTER (
        WHERE event.event_type = 'product_view'
          AND pg_catalog.btrim(COALESCE(candidate.product_name, '')) <> ''
      ) AS view_product_name,
      pg_catalog.max(candidate.product_name) FILTER (
        WHERE event.event_type IN ('purchase', 'add_to_cart')
          AND pg_catalog.btrim(COALESCE(candidate.product_name, '')) <> ''
      ) AS action_product_name,
      pg_catalog.count(*) FILTER (
        WHERE event.event_type = 'product_view'
      ) AS view_count,
      pg_catalog.count(*) FILTER (
        WHERE event.event_type IN ('purchase', 'add_to_cart')
      ) AS action_count
    FROM public.analytics_events AS event
    CROSS JOIN LATERAL (
      SELECT
        normalized.product_id,
        pg_catalog.max(normalized.product_name) FILTER (
          WHERE pg_catalog.btrim(COALESCE(normalized.product_name, '')) <> ''
        ) AS product_name
      FROM (
        SELECT
          COALESCE(item ->> 'product_id', item ->> 'id') AS product_id,
          COALESCE(item ->> 'product_name', item ->> 'name') AS product_name
        FROM pg_catalog.jsonb_array_elements(
          pg_catalog.jsonb_build_array(event.event_data)
          || CASE
            WHEN pg_catalog.jsonb_typeof(event.event_data -> 'items') = 'array'
              THEN event.event_data -> 'items'
            ELSE '[]'::jsonb
          END
        ) AS item
      ) AS normalized
      WHERE pg_catalog.btrim(COALESCE(normalized.product_id, '')) <> ''
      GROUP BY normalized.product_id
    ) AS candidate
    WHERE event.merchant_id = p_merchant_id
      AND event.event_type IN ('product_view', 'purchase', 'add_to_cart')
      AND event.event_timestamp >= p_start_date
      AND event.event_timestamp <= p_end_date
    GROUP BY candidate.product_id
  )
  SELECT pg_catalog.jsonb_build_object(
    'id', top_conversion.product_id,
    'name', top_conversion.product_name,
    'conversionRate', top_conversion.conversion_rate,
    'views', top_conversion.view_count,
    'actions', top_conversion.capped_action_count
  )
  INTO v_top_converting
  FROM (
    SELECT
      activity.product_id,
      COALESCE(
        activity.view_product_name,
        activity.action_product_name,
        'Unknown Product'
      ) AS product_name,
      activity.view_count,
      LEAST(
        activity.action_count, activity.view_count
      ) AS capped_action_count,
      (
        LEAST(activity.action_count, activity.view_count)::numeric
        / activity.view_count::numeric
      ) * 100 AS conversion_rate,
      activity.action_count AS raw_action_count
    FROM product_activity AS activity
    WHERE activity.view_count >= 10
      AND activity.action_count > 0
    ORDER BY
      conversion_rate DESC,
      raw_action_count DESC,
      product_name ASC
    LIMIT 1
  ) AS top_conversion;

  RETURN pg_catalog.jsonb_build_object(
    'mostSearched', v_most_searched,
    'topConverting', v_top_converting
  );
END;
$$;

ALTER FUNCTION public.get_website_performance_event_summary(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) OWNER TO postgres;

COMMENT ON FUNCTION public.get_website_performance_event_summary(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) IS 'Returns bounded website search and conversion aggregates without materializing wide event rows.';

REVOKE ALL ON FUNCTION public.get_website_performance_event_summary(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_website_performance_event_summary(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) TO authenticated, service_role;
