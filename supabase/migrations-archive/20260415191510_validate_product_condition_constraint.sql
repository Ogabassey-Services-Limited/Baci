-- Canonicalization has already rewritten legacy aliases, so the products
-- condition constraint can now be fully validated against the canonical set.

ALTER TABLE public.products
VALIDATE CONSTRAINT check_condition;
