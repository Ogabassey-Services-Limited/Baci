-- Canonical audit coverage for staff membership and effective-access changes.
-- Invitation tokens and target contact values never enter immutable audit data.

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

  IF pg_catalog.jsonb_typeof(v_default_permissions) = 'object' THEN
    v_effective_permissions := v_default_permissions;
  END IF;

  -- Mirror the application's per-resource deep merge before reducing it to
  -- normalized grant identifiers. Raw values never enter immutable output,
  -- but string/number boolean spellings retain their runtime effect.
  IF pg_catalog.jsonb_typeof(p_custom_permissions) = 'object' THEN
    FOR v_resource, v_actions IN
      SELECT entry.key, entry.value
      FROM pg_catalog.jsonb_each(p_custom_permissions) AS entry(key, value)
    LOOP
      IF v_resource !~ '^([*]|[a-z][a-z0-9_]{0,63})$' THEN
        CONTINUE;
      END IF;

      -- Runtime deep merge replaces a default resource with a non-object
      -- custom value, making its nested actions inaccessible. Preserve that
      -- effective denial rather than retaining the default grants in audit.
      IF pg_catalog.jsonb_typeof(v_actions) <> 'object' THEN
        v_effective_permissions := pg_catalog.jsonb_set(
          v_effective_permissions,
          ARRAY[v_resource],
          v_actions,
          true
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
                v_action,
                v_permission_value
              )
            ELSE pg_catalog.jsonb_build_object(v_action, v_permission_value)
          END,
          true
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(permission.identifier ORDER BY permission.identifier)
    FROM (
      SELECT resource.key || '.' || action.key AS identifier
      FROM pg_catalog.jsonb_each(v_effective_permissions) AS resource(key, value)
      CROSS JOIN LATERAL pg_catalog.jsonb_each(
        CASE
          WHEN pg_catalog.jsonb_typeof(resource.value) = 'object'
            THEN resource.value
          ELSE '{}'::jsonb
        END
      ) AS action(key, value)
      WHERE resource.key ~ '^([*]|[a-z][a-z0-9_]{0,63})$'
        AND action.key ~ '^([*]|[a-z][a-z0-9_]{0,63})$'
        AND CASE pg_catalog.jsonb_typeof(action.value)
          WHEN 'boolean' THEN action.value = 'true'::jsonb
          WHEN 'number' THEN
            CASE
              WHEN pg_catalog.pg_input_is_valid(
                action.value #>> '{}',
                'boolean'::text
              ) THEN (action.value #>> '{}')::boolean
              ELSE false
            END
          WHEN 'string' THEN
            CASE
              WHEN pg_catalog.pg_input_is_valid(
                action.value #>> '{}',
                'boolean'::text
              ) THEN (action.value #>> '{}')::boolean
              ELSE false
            END
          ELSE false
        END
    ) AS permission
  ), '[]'::jsonb);
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

CREATE OR REPLACE FUNCTION private.audit_staff_access_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exact_access_fields text[] := ARRAY['role', 'status']::text[];
  v_permission_fields text[] := ARRAY['permissions']::text[];
  v_contact_presence_fields text[] := ARRAY['email', 'name', 'phone']::text[];
  v_invitation_state_fields text[] := ARRAY[
    'invitation_expires_at', 'invited_at'
  ]::text[];
  v_acceptance_state_fields text[] := ARRAY['accepted_at']::text[];
  v_identity_fields text[] := ARRAY['user_id']::text[];
  v_tenant_identity_fields text[] := ARRAY['merchant_id']::text[];
  v_forbidden_fields text[] := ARRAY['id', 'invitation_token']::text[];
  v_ignored_fields text[] := ARRAY[
    'created_at', 'last_login_at', 'updated_at'
  ]::text[];
  v_classified_fields text[];
  v_old_access_values jsonb := '{}'::jsonb;
  v_new_access_values jsonb := '{}'::jsonb;
  v_old_contact_values jsonb := '{}'::jsonb;
  v_new_contact_values jsonb := '{}'::jsonb;
  v_old_invitation_state jsonb := '{}'::jsonb;
  v_new_invitation_state jsonb := '{}'::jsonb;
  v_old_acceptance_state jsonb := '{}'::jsonb;
  v_new_acceptance_state jsonb := '{}'::jsonb;
  v_old_permissions jsonb := '[]'::jsonb;
  v_new_permissions jsonb := '[]'::jsonb;
  v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
  v_field text;
  v_merchant_id uuid;
  v_staff_id uuid;
  v_merchant_label text;
  v_action text;
  v_writer_capability uuid;
  v_contact_changed boolean := false;
  v_invitation_changed boolean := false;
  v_acceptance_changed boolean := false;
  v_target_identity_changed boolean := false;
BEGIN
  -- Keep audit treatment closed as staff_members evolves. Explicit categories
  -- distinguish safe projected data from forbidden raw credentials and ignored
  -- timestamps/row identifiers.
  v_classified_fields := v_exact_access_fields || v_permission_fields ||
    v_contact_presence_fields || v_invitation_state_fields ||
    v_acceptance_state_fields || v_identity_fields || v_tenant_identity_fields ||
    v_forbidden_fields || v_ignored_fields;

  IF pg_catalog.cardinality(v_classified_fields) <> (
    SELECT pg_catalog.count(DISTINCT classified_field.name)
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
    LEFT JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = 'public.staff_members'::pg_catalog.regclass
      AND attribute.attname = classified_field.name
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
    WHERE attribute.attname IS NULL
  ) THEN
    RAISE EXCEPTION 'audit_staff_access_classification_invalid'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.staff_members'::pg_catalog.regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attname <> ALL(v_classified_fields)
  ) THEN
    RAISE EXCEPTION 'audit_staff_access_unclassified_column'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'audit_staff_access_id_reassignment_forbidden'
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.merchant_id IS DISTINCT FROM NEW.merchant_id THEN
    RAISE EXCEPTION 'audit_staff_access_merchant_reassignment_forbidden'
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP <> 'INSERT'
    AND OLD.permissions IS NOT NULL
    AND pg_catalog.jsonb_typeof(OLD.permissions) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'audit_staff_access_permissions_shape_invalid'
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP <> 'DELETE'
    AND NEW.permissions IS NOT NULL
    AND pg_catalog.jsonb_typeof(NEW.permissions) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'audit_staff_access_permissions_shape_invalid'
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_merchant_id := OLD.merchant_id;
    v_staff_id := OLD.id;
  ELSE
    v_merchant_id := NEW.merchant_id;
    v_staff_id := NEW.id;
  END IF;

  IF v_merchant_id IS NULL OR v_staff_id IS NULL THEN
    RAISE EXCEPTION 'audit_staff_access_identity_required' USING ERRCODE = '22023';
  END IF;

  -- Parent cascades can remove the merchant before this AFTER DELETE trigger;
  -- retain the immutable UUID and leave the optional convenience label null.
  SELECT NULLIF(pg_catalog.btrim(merchant.business_name), '')
    INTO v_merchant_label
  FROM public.merchants AS merchant
  WHERE merchant.id = v_merchant_id;
  IF v_merchant_label IS NOT NULL
    AND pg_catalog.char_length(v_merchant_label) > 160 THEN
    v_merchant_label := NULL;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_old_access_values := pg_catalog.jsonb_build_object(
      'role', OLD.role,
      'status', OLD.status
    );
    v_old_contact_values := pg_catalog.jsonb_build_object(
      'email', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(OLD.email), '') IS NOT NULL
      ),
      'name', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(OLD.name), '') IS NOT NULL
      ),
      'phone', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(OLD.phone), '') IS NOT NULL
      )
    );
    v_old_invitation_state := pg_catalog.jsonb_build_object(
      'expires_at_present', OLD.invitation_expires_at IS NOT NULL,
      'invited_at_present', OLD.invited_at IS NOT NULL,
      'token_present', NULLIF(pg_catalog.btrim(OLD.invitation_token), '') IS NOT NULL
    );
    v_old_acceptance_state := pg_catalog.jsonb_build_object(
      'accepted', OLD.accepted_at IS NOT NULL
    );
    v_old_permissions := private.project_staff_effective_permissions_for_audit_v1(
      OLD.role,
      OLD.permissions
    );
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_access_values := pg_catalog.jsonb_build_object(
      'role', NEW.role,
      'status', NEW.status
    );
    v_new_contact_values := pg_catalog.jsonb_build_object(
      'email', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(NEW.email), '') IS NOT NULL
      ),
      'name', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(NEW.name), '') IS NOT NULL
      ),
      'phone', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(NEW.phone), '') IS NOT NULL
      )
    );
    v_new_invitation_state := pg_catalog.jsonb_build_object(
      'expires_at_present', NEW.invitation_expires_at IS NOT NULL,
      'invited_at_present', NEW.invited_at IS NOT NULL,
      'token_present', NULLIF(pg_catalog.btrim(NEW.invitation_token), '') IS NOT NULL
    );
    v_new_acceptance_state := pg_catalog.jsonb_build_object(
      'accepted', NEW.accepted_at IS NOT NULL
    );
    v_new_permissions := private.project_staff_effective_permissions_for_audit_v1(
      NEW.role,
      NEW.permissions
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_changed_fields := ARRAY[
      'role', 'status', 'permissions', 'invitation', 'acceptance'
    ]::text[];
    v_after_values := v_new_access_values || pg_catalog.jsonb_build_object(
      'permissions', v_new_permissions,
      'invitation', v_new_invitation_state,
      'acceptance', v_new_acceptance_state
    );
    IF NEW.user_id IS NOT NULL THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'target_user_id');
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'target_user_id', NEW.user_id
      );
    END IF;
    FOREACH v_field IN ARRAY v_contact_presence_fields LOOP
      IF (v_new_contact_values -> v_field ->> 'present') = 'true' THEN
        v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
        v_after_values := v_after_values || pg_catalog.jsonb_build_object(
          v_field,
          v_new_contact_values -> v_field
        );
      END IF;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    v_changed_fields := ARRAY[
      'role', 'status', 'permissions', 'invitation', 'acceptance'
    ]::text[];
    v_before_values := v_old_access_values || pg_catalog.jsonb_build_object(
      'permissions', v_old_permissions,
      'invitation', v_old_invitation_state,
      'acceptance', v_old_acceptance_state
    );
    IF OLD.user_id IS NOT NULL THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'target_user_id');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'target_user_id', OLD.user_id
      );
    END IF;
    FOREACH v_field IN ARRAY v_contact_presence_fields LOOP
      IF (v_old_contact_values -> v_field ->> 'present') = 'true' THEN
        v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
        v_before_values := v_before_values || pg_catalog.jsonb_build_object(
          v_field,
          v_old_contact_values -> v_field
        );
      END IF;
    END LOOP;
  ELSE
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'role');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'role', v_old_access_values -> 'role'
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'role', v_new_access_values -> 'role'
      );
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'status');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'status', v_old_access_values -> 'status'
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'status', v_new_access_values -> 'status'
      );
    END IF;
    IF OLD.permissions IS DISTINCT FROM NEW.permissions
      OR v_old_permissions IS DISTINCT FROM v_new_permissions THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'permissions');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'permissions', v_old_permissions
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'permissions', v_new_permissions
      );
    END IF;

    v_invitation_changed := OLD.invitation_token IS DISTINCT FROM NEW.invitation_token
      OR OLD.invitation_expires_at IS DISTINCT FROM NEW.invitation_expires_at
      OR OLD.invited_at IS DISTINCT FROM NEW.invited_at;
    IF v_invitation_changed THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'invitation');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'invitation', v_old_invitation_state
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'invitation', v_new_invitation_state
      );
    END IF;

    v_acceptance_changed := OLD.accepted_at IS DISTINCT FROM NEW.accepted_at;
    IF v_acceptance_changed THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'acceptance');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'acceptance', v_old_acceptance_state
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'acceptance', v_new_acceptance_state
      );
    END IF;

    v_target_identity_changed := OLD.user_id IS DISTINCT FROM NEW.user_id;
    IF v_target_identity_changed THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'target_user_id');
      IF OLD.user_id IS NOT NULL THEN
        v_before_values := v_before_values || pg_catalog.jsonb_build_object(
          'target_user_id', OLD.user_id
        );
      END IF;
      IF NEW.user_id IS NOT NULL THEN
        v_after_values := v_after_values || pg_catalog.jsonb_build_object(
          'target_user_id', NEW.user_id
        );
      END IF;
    END IF;

    FOREACH v_field IN ARRAY v_contact_presence_fields LOOP
      IF (v_field = 'email' AND OLD.email IS DISTINCT FROM NEW.email)
        OR (v_field = 'name' AND OLD.name IS DISTINCT FROM NEW.name)
        OR (v_field = 'phone' AND OLD.phone IS DISTINCT FROM NEW.phone) THEN
        v_contact_changed := true;
        v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
        v_before_values := v_before_values || pg_catalog.jsonb_build_object(
          v_field,
          v_old_contact_values -> v_field
        );
        v_after_values := v_after_values || pg_catalog.jsonb_build_object(
          v_field,
          v_new_contact_values -> v_field
        );
      END IF;
    END LOOP;
  END IF;

  IF pg_catalog.cardinality(v_changed_fields) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NULLIF(pg_catalog.btrim(NEW.invitation_token), '') IS NOT NULL THEN
      v_action := 'staff.invited';
    ELSE
      v_action := 'staff.access_created';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'staff.removed';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'removed' THEN
      v_action := 'staff.removed';
    ELSIF OLD.status = 'removed' THEN
      v_action := 'staff.reactivated';
    ELSIF NEW.status = 'suspended' THEN
      v_action := 'staff.suspended';
    ELSIF OLD.status = 'pending'
      AND NEW.status = 'active'
      AND NEW.user_id IS NOT NULL
      AND NEW.accepted_at IS NOT NULL THEN
      v_action := 'staff.accepted';
    ELSIF OLD.status = 'suspended' AND NEW.status = 'active' THEN
      v_action := 'staff.reactivated';
    ELSE
      v_action := 'staff.status_changed';
    END IF;
  ELSIF (v_acceptance_changed OR (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL))
    AND NEW.status = 'active'
    AND NEW.user_id IS NOT NULL
    AND NEW.accepted_at IS NOT NULL THEN
    v_action := 'staff.accepted';
  ELSIF OLD.role IS DISTINCT FROM NEW.role THEN
    v_action := 'staff.role_changed';
  ELSIF OLD.permissions IS DISTINCT FROM NEW.permissions THEN
    v_action := 'staff.permissions_changed';
  ELSIF v_invitation_changed THEN
    v_action := 'staff.invited';
  ELSIF v_contact_changed THEN
    v_action := 'staff.contact_changed';
  ELSE
    v_action := 'staff.access_changed';
  END IF;

  -- Keep a stable linked target identity in every update snapshot while the
  -- membership remains linked. This includes role, permission, lifecycle, and
  -- soft-removal changes without falsely marking the link itself as changed.
  IF TG_OP = 'UPDATE'
    AND OLD.user_id IS NOT NULL
    AND NEW.user_id IS NOT NULL
    AND NOT v_target_identity_changed THEN
    v_before_values := v_before_values || pg_catalog.jsonb_build_object(
      'target_user_id', OLD.user_id
    );
    v_after_values := v_after_values || pg_catalog.jsonb_build_object(
      'target_user_id', NEW.user_id
    );
  END IF;

  IF pg_catalog.octet_length(v_before_values::text) > 16384
    OR pg_catalog.octet_length(v_after_values::text) > 16384 THEN
    RAISE EXCEPTION 'audit_staff_access_payload_too_large'
      USING ERRCODE = '54000';
  END IF;

  SELECT capability.capability
    INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';

  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_staff_access_writer_capability_unavailable'
      USING ERRCODE = '42501';
  END IF;

  PERFORM private.write_audit_event_v1(
    v_merchant_id,
    v_merchant_label,
    v_action,
    'staff_member'::text,
    v_staff_id::text,
    v_changed_fields,
    NULLIF(v_before_values, '{}'::jsonb),
    NULLIF(v_after_values, '{}'::jsonb),
    NULL::uuid,
    NULL::uuid,
    1::smallint,
    pg_catalog.jsonb_build_object(
      'category', 'staff_access',
      'operation', pg_catalog.lower(TG_OP)
    ),
    v_writer_capability
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION private.audit_staff_access_change_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_staff_access_change_v1()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_staff_access_change_v1 ON public.staff_members;
CREATE TRIGGER audit_staff_access_change_v1
  AFTER INSERT OR DELETE OR UPDATE
  ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_staff_access_change_v1();
