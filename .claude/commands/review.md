Review the current code changes for quality, security, and maintainability.

Focus areas:
1. TypeScript strict compliance (no `any`, proper generics)
2. Supabase client usage (correct factory: server/client/admin)
3. Auth checks before all data operations
4. Zod validation on API inputs
5. React Server vs Client Component correctness
6. Security (no secrets in client code, XSS prevention, CSRF)
7. Consistent error handling
8. Accessibility (aria labels, semantic HTML)

If a specific scope is provided, focus the review on: $ARGUMENTS

Show results as CRITICAL > WARNING > SUGGESTION with specific fix examples.
