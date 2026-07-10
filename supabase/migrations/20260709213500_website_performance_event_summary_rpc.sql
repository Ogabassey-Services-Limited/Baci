-- disable-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_events_merchant_type_timestamp_idx
  ON public.analytics_events (merchant_id, event_type, event_timestamp DESC);

CREATE OR REPLACE FUNCTION public.get_website_performance_event_summary(
  p_merchant_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text := COALESCE((SELECT auth.role()), '');
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
        AND COALESCE(
          (staff.permissions -> 'analytics' ->> 'view')::boolean,
          (role_permissions.permissions -> 'analytics' ->> 'view')::boolean,
          false
        )
    ) THEN
      RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN (
    WITH scoped_events AS (
      SELECT id, event_type, event_data
      FROM public.analytics_events
      WHERE merchant_id = p_merchant_id
        AND event_timestamp >= p_start_date
        AND event_timestamp <= p_end_date
        AND event_type IN ('search', 'product_view', 'purchase', 'add_to_cart')
    ),
    search_counts AS (
      SELECT
        lower(trim(COALESCE(event_data ->> 'search_term', event_data ->> 'query'))) AS query,
        count(*) AS search_count
      FROM scoped_events
      WHERE event_type = 'search'
        AND trim(COALESCE(event_data ->> 'search_term', event_data ->> 'query', '')) <> ''
      GROUP BY lower(trim(COALESCE(event_data ->> 'search_term', event_data ->> 'query')))
    ),
    top_search AS (
      SELECT query, search_count
      FROM search_counts
      ORDER BY search_count DESC, query ASC
      LIMIT 1
    ),
    product_view_candidates AS (
      SELECT
        id AS event_id,
        COALESCE(event_data ->> 'product_id', event_data ->> 'id') AS product_id,
        COALESCE(event_data ->> 'product_name', event_data ->> 'name') AS product_name
      FROM scoped_events
      WHERE event_type = 'product_view'

      UNION ALL

      SELECT
        event.id AS event_id,
        COALESCE(item ->> 'product_id', item ->> 'id') AS product_id,
        COALESCE(item ->> 'product_name', item ->> 'name') AS product_name
      FROM scoped_events AS event
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(event.event_data -> 'items') = 'array'
            THEN event.event_data -> 'items'
          ELSE '[]'::jsonb
        END
      ) AS item
      WHERE event.event_type = 'product_view'
    ),
    product_views AS (
      SELECT
        product_id,
        max(product_name) FILTER (WHERE trim(COALESCE(product_name, '')) <> '') AS product_name,
        count(DISTINCT event_id) AS view_count
      FROM product_view_candidates
      WHERE trim(COALESCE(product_id, '')) <> ''
      GROUP BY product_id
    ),
    conversion_candidates AS (
      SELECT
        id AS event_id,
        COALESCE(event_data ->> 'product_id', event_data ->> 'id') AS product_id,
        COALESCE(event_data ->> 'product_name', event_data ->> 'name') AS product_name
      FROM scoped_events
      WHERE event_type IN ('purchase', 'add_to_cart')

      UNION ALL

      SELECT
        event.id AS event_id,
        COALESCE(item ->> 'product_id', item ->> 'id') AS product_id,
        COALESCE(item ->> 'product_name', item ->> 'name') AS product_name
      FROM scoped_events AS event
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(event.event_data -> 'items') = 'array'
            THEN event.event_data -> 'items'
          ELSE '[]'::jsonb
        END
      ) AS item
      WHERE event.event_type IN ('purchase', 'add_to_cart')
    ),
    product_actions AS (
      SELECT
        product_id,
        max(product_name) FILTER (WHERE trim(COALESCE(product_name, '')) <> '') AS product_name,
        count(DISTINCT event_id) AS action_count
      FROM conversion_candidates
      WHERE trim(COALESCE(product_id, '')) <> ''
      GROUP BY product_id
    ),
    top_conversion AS (
      SELECT
        views.product_id,
        COALESCE(views.product_name, actions.product_name, 'Unknown Product') AS product_name,
        views.view_count,
        least(actions.action_count, views.view_count) AS action_count,
        (
          least(actions.action_count, views.view_count)::numeric
          / views.view_count::numeric
        ) * 100 AS conversion_rate
      FROM product_views AS views
      INNER JOIN product_actions AS actions USING (product_id)
      WHERE views.view_count >= 10
        AND actions.action_count > 0
      ORDER BY conversion_rate DESC, actions.action_count DESC, product_name ASC
      LIMIT 1
    )
    SELECT jsonb_build_object(
      'mostSearched', (
        SELECT jsonb_build_object('query', query, 'count', search_count)
        FROM top_search
      ),
      'topConverting', (
        SELECT jsonb_build_object(
          'id', product_id,
          'name', product_name,
          'conversionRate', conversion_rate,
          'views', view_count,
          'actions', action_count
        )
        FROM top_conversion
      )
    )
  );
END;
$$;

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
