-- Replay-gate registry for the focused merchant identity security checks.
-- Keep the scenarios separate so a new check does not turn this into another
-- oversized catch-all regression script. They deliberately share one
-- transaction: later scenarios assert the audited state created by earlier
-- guarded writes, and ROLLBACK leaves a replay database unchanged.
\set ON_ERROR_STOP on
BEGIN;
\ir merchant_identity_settings_security_fixture.sql
\ir merchant_identity_settings_security_direct_write.sql
\ir merchant_identity_settings_security_recent_auth.sql
\ir merchant_identity_settings_security_audit.sql
\ir merchant_identity_settings_security_mfa.sql
\ir merchant_identity_settings_security_aal2.sql
\ir merchant_identity_settings_security_revoked_session.sql
ROLLBACK;
