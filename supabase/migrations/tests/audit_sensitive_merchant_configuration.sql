-- Regression contract for 20260730000300_audit_sensitive_merchant_configuration.sql.
-- This fixture runs after every pending migration and rolls back all rows.

\ir audit_sensitive_merchant_configuration/001_setup_and_guard.sql
\ir audit_sensitive_merchant_configuration/002_configuration_and_clear.sql
\ir audit_sensitive_merchant_configuration/003_kyc_and_grouping.sql
\ir audit_sensitive_merchant_configuration/004_create_delete_and_rollback.sql
