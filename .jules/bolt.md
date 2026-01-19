## 2024-05-23 - Local Dev Environment Constraints
**Learning:** The `apps/web` development server enforces strict runtime connectivity checks for Supabase via `env.ts`, preventing startup with dummy environment variables (e.g., `NEXT_PUBLIC_SUPABASE_URL`) for isolated UI testing. This effectively blocks visual verification of components without valid credentials.
**Action:** Future optimizations should rely on unit tests mocking the environment or specifically isolating components in a storybook-like environment if available, rather than relying on full app startup.
