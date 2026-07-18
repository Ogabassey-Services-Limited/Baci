-- Validate separately so the ACCESS EXCLUSIVE lock from adding the constraint
-- is released before PostgreSQL scans existing reconciliation rows.
ALTER TABLE public.reconciliation_review
  VALIDATE CONSTRAINT reconciliation_review_issue_type_check;
