-- Regression contract for 20260730000200_audit_staff_access_changes.sql.
-- Ordered parts share one transaction so lifecycle state remains realistic.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE audit_staff_access_event_counts (
  label text PRIMARY KEY,
  event_count integer NOT NULL
);

\ir audit_staff_access_changes/001_setup_and_invitation.sql
\ir audit_staff_access_changes/002_identity_and_acceptance.sql
\ir audit_staff_access_changes/003_permissions_and_role.sql
\ir audit_staff_access_changes/004_lifecycle_and_noop.sql
\ir audit_staff_access_changes/005_rollback_and_redaction.sql
\ir audit_staff_access_changes/006_oversized_legacy_cleanup.sql
\ir audit_staff_access_changes/007_unclassified_column.sql

ROLLBACK;
