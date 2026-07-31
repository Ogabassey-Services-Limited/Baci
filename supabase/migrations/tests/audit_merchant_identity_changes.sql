-- Regression contract for 20260730000100_audit_merchant_identity_changes.sql.
-- This fixture runs after every pending migration and rolls back all rows.

\ir audit_merchant_identity_changes/000_trigger_predicate_permissions.sql
\ir audit_merchant_identity_changes/001_setup_and_guard.sql
\ir audit_merchant_identity_changes/002_update_and_safe_social.sql
\ir audit_merchant_identity_changes/003_raw_social_and_lifecycle.sql
\ir audit_merchant_identity_changes/004_lifecycle_and_delete.sql
