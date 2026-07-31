-- Keep legacy, unconstrained staff permission documents from preventing an
-- otherwise valid access cleanup or delete. The audit ledger records a stable
-- redaction marker rather than a partial, misleading grant list.

CREATE OR REPLACE FUNCTION private.project_staff_effective_permissions_for_audit_v1(
  p_role public.staff_role,
  p_custom_permissions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_default_permissions jsonb;
  v_effective_permissions jsonb := '{}'::jsonb;
  v_projected_permissions jsonb;
  v_resource text;
  v_actions jsonb;
  v_action text;
  v_permission_value jsonb;
BEGIN
  IF p_role IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT role_permission.permissions
    INTO v_default_permissions
  FROM public.role_permissions AS role_permission
  WHERE role_permission.role = p_role;

  -- This projection is included in both before and after snapshots on some
  -- updates. Bound the source before iterating it so an old, valid-but-huge
  -- legacy document cannot make cleanup, deletion, or a parent cascade fail.
  IF pg_catalog.octet_length(COALESCE(v_default_permissions, '{}'::jsonb)::text)
      + pg_catalog.octet_length(COALESCE(p_custom_permissions, '{}'::jsonb)::text)
      > 4096 THEN
    RETURN pg_catalog.jsonb_build_array('__audit_projection_redacted__');
  END IF;

  IF pg_catalog.jsonb_typeof(v_default_permissions) = 'object' THEN
    v_effective_permissions := v_default_permissions;
  END IF;

  IF pg_catalog.jsonb_typeof(p_custom_permissions) = 'object' THEN
    FOR v_resource, v_actions IN
      SELECT entry.key, entry.value
      FROM pg_catalog.jsonb_each(p_custom_permissions) AS entry(key, value)
    LOOP
      IF v_resource !~ '^([*]|[a-z][a-z0-9_]{0,63})$' THEN
        CONTINUE;
      END IF;

      IF pg_catalog.jsonb_typeof(v_actions) <> 'object' THEN
        v_effective_permissions := pg_catalog.jsonb_set(
          v_effective_permissions, ARRAY[v_resource], v_actions, true
        );
        CONTINUE;
      END IF;

      FOR v_action, v_permission_value IN
        SELECT entry.key, entry.value
        FROM pg_catalog.jsonb_each(v_actions) AS entry(key, value)
      LOOP
        IF v_action !~ '^([*]|[a-z][a-z0-9_]{0,63})$' THEN
          CONTINUE;
        END IF;

        v_effective_permissions := pg_catalog.jsonb_set(
          v_effective_permissions,
          ARRAY[v_resource],
          CASE
            WHEN pg_catalog.jsonb_typeof(v_effective_permissions -> v_resource) = 'object'
              THEN (v_effective_permissions -> v_resource) || pg_catalog.jsonb_build_object(
                v_action, v_permission_value
              )
            ELSE pg_catalog.jsonb_build_object(v_action, v_permission_value)
          END,
          true
        );
      END LOOP;
    END LOOP;
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(permission.identifier ORDER BY permission.identifier), '[]'::jsonb)
    INTO v_projected_permissions
  FROM (
    SELECT resource.key || '.' || action.key AS identifier
    FROM pg_catalog.jsonb_each(v_effective_permissions) AS resource(key, value)
    CROSS JOIN LATERAL pg_catalog.jsonb_each(
      CASE WHEN pg_catalog.jsonb_typeof(resource.value) = 'object'
        THEN resource.value ELSE '{}'::jsonb END
    ) AS action(key, value)
    WHERE resource.key ~ '^([*]|[a-z][a-z0-9_]{0,63})$'
      AND action.key ~ '^([*]|[a-z][a-z0-9_]{0,63})$'
      AND CASE pg_catalog.jsonb_typeof(action.value)
        WHEN 'boolean' THEN action.value = 'true'::jsonb
        WHEN 'number' THEN CASE WHEN pg_catalog.pg_input_is_valid(action.value #>> '{}', 'boolean'::text)
          THEN (action.value #>> '{}')::boolean ELSE false END
        WHEN 'string' THEN CASE WHEN pg_catalog.pg_input_is_valid(action.value #>> '{}', 'boolean'::text)
          THEN (action.value #>> '{}')::boolean ELSE false END
        ELSE false
      END
  ) AS permission;

  IF pg_catalog.octet_length(v_projected_permissions::text) > 4096 THEN
    RETURN pg_catalog.jsonb_build_array('__audit_projection_redacted__');
  END IF;

  RETURN v_projected_permissions;
END;
$$;

ALTER FUNCTION private.project_staff_effective_permissions_for_audit_v1(
  public.staff_role,
  jsonb
) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.project_staff_effective_permissions_for_audit_v1(
  public.staff_role,
  jsonb
) FROM PUBLIC, anon, authenticated, service_role;
