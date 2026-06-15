-- Allow product condition canonicalization to write open_box without violating
-- the legacy products.check_condition constraint, while still steering future
-- writes toward the rollout's canonical condition set.

ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS check_condition;

ALTER TABLE public.products
ADD CONSTRAINT check_condition
CHECK (condition IN ('new', 'used', 'open_box'))
NOT VALID;
