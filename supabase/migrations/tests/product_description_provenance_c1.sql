-- C1 migration regression contract. Run only against a disposable full-history
-- replay database. Each focused contract runs in one transaction and all
-- fixtures are rolled back.
BEGIN;

\ir product_description_provenance_c1/001_schema_and_fixtures.sql
\ir product_description_provenance_c1/002_authorization_and_replay.sql
\ir product_description_provenance_c1/003_retention_and_operation_bindings.sql
\ir product_description_provenance_c1/004_issuance_budget.sql

ROLLBACK;
