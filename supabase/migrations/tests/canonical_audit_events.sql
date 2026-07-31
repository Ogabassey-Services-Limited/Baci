-- Regression contract for the canonical audit ledger. Run this wrapper with
-- psql so each bounded fixture part shares its setup and rollback transaction.

\set ON_ERROR_STOP on
BEGIN;

\ir canonical_audit_events_setup.sql
\ir canonical_audit_events_foundation.sql
\ir canonical_audit_events_capability.sql
\ir canonical_audit_events_actor_inputs.sql
\ir canonical_audit_events_validation.sql
\ir canonical_audit_events_reader.sql
\ir canonical_audit_events_retention.sql

ROLLBACK;
