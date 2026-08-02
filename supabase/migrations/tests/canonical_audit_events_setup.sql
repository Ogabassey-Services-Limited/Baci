-- Shared temporary trigger fixtures. This file is included only by
-- canonical_audit_events.sql, inside its rollback transaction.

CREATE TEMP TABLE audit_event_fixture (
  merchant_id uuid NOT NULL,
  merchant_label text,
  resource_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{"operation":"fixture"}'::jsonb,
  changed_fields text[] NOT NULL DEFAULT ARRAY['value']::text[],
  before_values jsonb,
  after_values jsonb
);

CREATE OR REPLACE FUNCTION pg_temp.capture_fixture_audit_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_writer_capability uuid;
BEGIN
  SELECT capability.capability INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
  PERFORM private.write_audit_event_v1(
    NEW.merchant_id, NEW.merchant_label, 'fixture.create'::text,
    'fixture_record'::text, NEW.resource_id, NEW.changed_fields,
    NEW.before_values, NEW.after_values, NULL::uuid, NULL::uuid, 1::smallint,
    NEW.metadata, v_writer_capability
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER capture_fixture_audit_v1
  AFTER INSERT ON pg_temp.audit_event_fixture
  FOR EACH ROW EXECUTE FUNCTION pg_temp.capture_fixture_audit_v1();

GRANT INSERT ON pg_temp.audit_event_fixture TO anon, authenticated, service_role;

CREATE TEMP TABLE audit_event_unreviewed_fixture (
  merchant_id uuid NOT NULL,
  resource_id text NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.capture_unreviewed_audit_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.write_audit_event_v1(
    NEW.merchant_id, NULL::text, 'fixture.create'::text,
    'fixture_record'::text, NEW.resource_id, ARRAY[]::text[], NULL::jsonb,
    NULL::jsonb, NULL::uuid, NULL::uuid, 1::smallint, '{}'::jsonb, NULL::uuid
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER capture_unreviewed_audit_v1
  AFTER INSERT ON pg_temp.audit_event_unreviewed_fixture
  FOR EACH ROW EXECUTE FUNCTION pg_temp.capture_unreviewed_audit_v1();

GRANT INSERT ON pg_temp.audit_event_unreviewed_fixture TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TEMP TABLE audit_event_attacker_fixture (
  merchant_id uuid NOT NULL,
  resource_id text NOT NULL
);

SET LOCAL ROLE authenticated;
CREATE OR REPLACE FUNCTION pg_temp.capture_attacker_audit_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_writer_capability uuid;
BEGIN
  BEGIN
    INSERT INTO private.audit_event_writer_capabilities (capability_name)
    VALUES ('canonical_audit_event_writer_v1');
    RAISE EXCEPTION 'attacker trigger minted an audit writer capability';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    SELECT capability.capability INTO v_writer_capability
    FROM private.audit_event_writer_capabilities AS capability
    WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
    RAISE EXCEPTION 'attacker trigger read an audit writer capability';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM private.write_audit_event_v1(
    NEW.merchant_id, NULL::text, 'fixture.create'::text,
    'fixture_record'::text, NEW.resource_id, ARRAY[]::text[], NULL::jsonb,
    NULL::jsonb, NULL::uuid, NULL::uuid, 1::smallint, '{}'::jsonb,
    v_writer_capability
  );
  RETURN NEW;
END;
$$;
RESET ROLE;

CREATE TRIGGER capture_attacker_audit_v1
  AFTER INSERT ON pg_temp.audit_event_attacker_fixture
  FOR EACH ROW EXECUTE FUNCTION pg_temp.capture_attacker_audit_v1();

GRANT INSERT ON pg_temp.audit_event_attacker_fixture TO authenticated;
