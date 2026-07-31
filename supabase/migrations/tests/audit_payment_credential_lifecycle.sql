-- Regression contract for 20260730000500_audit_payment_credential_lifecycle.sql.
-- This fixture runs after every pending migration and rolls back all rows.
-- Execute with `psql -f`: psql's \ir keeps the ordered sections in one session
-- and one rollback-only transaction. Leaf sections are not standalone fixtures.

BEGIN;

CREATE TEMP TABLE audit_payment_credential_sentinels (
  lifecycle text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (lifecycle, value)
);

\ir audit_payment_credential_lifecycle/01_setup_and_create.sql
\ir audit_payment_credential_lifecycle/02_schema_and_disable.sql
\ir audit_payment_credential_lifecycle/03_reactivation_and_pair_create.sql
\ir audit_payment_credential_lifecycle/04_pair_update_and_role_delete.sql
\ir audit_payment_credential_lifecycle/05_cascade_and_noop.sql
\ir audit_payment_credential_lifecycle/06_writer_rollback.sql

ROLLBACK;
