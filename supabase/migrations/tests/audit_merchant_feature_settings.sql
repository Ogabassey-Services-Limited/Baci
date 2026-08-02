-- Regression contract for 20260730000400_audit_merchant_feature_settings.sql.
-- Run this psql wrapper after all pending audit migrations. The included parts
-- deliberately share one session and transaction because later scenarios rely
-- on the preceding fixture state.

\set ON_ERROR_STOP on
BEGIN;

\ir audit_merchant_feature_settings_setup.sql
\ir audit_merchant_feature_settings_primary_mutations.sql
\ir audit_merchant_feature_settings_snapshot_updates.sql
\ir audit_merchant_feature_settings_lifecycle.sql

ROLLBACK;
