-- The public checkout wrapper is the authenticated storefront boundary. Keep
-- the private schema inaccessible to authenticated clients while executing the
-- private implementation with the function owner's privileges.
ALTER FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) OWNER TO postgres;

ALTER FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) SECURITY DEFINER;

ALTER FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) SET search_path = public;

-- The same invoker-wrapper pattern is used by savings, voucher, order reuse,
-- inventory, and storefront read RPCs. Harden every authenticated public
-- delegate before removing direct private-schema lookup from the caller.
DO $migration$
DECLARE
  v_wrapper regprocedure;
BEGIN
  FOR v_wrapper IN
    SELECT function_definition.oid::regprocedure
    FROM pg_catalog.pg_proc AS function_definition
    JOIN pg_catalog.pg_namespace AS function_schema
      ON function_schema.oid = function_definition.pronamespace
    JOIN pg_catalog.pg_language AS function_language
      ON function_language.oid = function_definition.prolang
    WHERE function_schema.nspname = 'public'
      AND function_definition.prokind = 'f'
      AND function_definition.prosecdef IS FALSE
      AND function_definition.prosrc LIKE '%private.%'
      -- Only promote wrappers whose entire body is a direct private-function
      -- delegation. Functions with declarations or other statements require
      -- an explicit security audit before their execution context can change.
      AND CASE function_language.lanname
        WHEN 'sql' THEN btrim(
          pg_catalog.regexp_replace(
            function_definition.prosrc,
            '[[:space:]]+',
            ' ',
            'g'
          )
        ) ~ '^SELECT (private\.|.+ FROM private\.).*;$'
        WHEN 'plpgsql' THEN btrim(
          pg_catalog.regexp_replace(
            function_definition.prosrc,
            '[[:space:]]+',
            ' ',
            'g'
          )
        ) ~ '^BEGIN RETURN( QUERY)? (SELECT .+ FROM )?private\..*; END;?$'
        ELSE FALSE
      END
      AND pg_catalog.has_function_privilege(
        'authenticated',
        function_definition.oid,
        'EXECUTE'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_wrapper);
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', v_wrapper);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_wrapper);
  END LOOP;
END;
$migration$;

REVOKE USAGE ON SCHEMA private FROM authenticated;
