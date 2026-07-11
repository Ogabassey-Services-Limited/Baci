-- Make the service_role EXECUTE grant on quiz_route_proof_valid explicit.
--
-- Context: the CI / Vercel production-approval gate
-- (apps/web/src/scripts/check-quiz-production-approval.ts) signs a throwaway
-- proof with QUIZ_RPC_SERVER_SECRET and calls
-- public.quiz_route_proof_valid(jsonb, text, text, uuid) through the
-- service_role client to confirm the database shares the same secret. A review
-- flagged the RPC as "non-granted to service_role".
--
-- On production, service_role ALREADY holds EXECUTE on BOTH overloads (verified
-- with has_function_privilege('service_role', ..., 'EXECUTE') = true), so the
-- gate works at runtime. The privilege was simply implicit: the original
-- migration (20260516084622_quiz_phase1a_rpcs.sql) only REVOKED the two
-- overloads from PUBLIC / anon / authenticated and never wrote an explicit
-- service_role GRANT, leaving the grant un-obvious in source.
--
-- These GRANTs make the intent explicit so the repository is self-consistent
-- with production. GRANT is idempotent: re-granting an already-held privilege is
-- a no-op, so this migration is safe to (re)apply anywhere.

GRANT EXECUTE ON FUNCTION public.quiz_route_proof_valid(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.quiz_route_proof_valid(jsonb, text, text, uuid) TO service_role;
