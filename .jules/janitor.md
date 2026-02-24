# Janitor's Journal

## 2026-02-12 - Mobile Admin Tooling Divergence
**Learning:** `apps/mobile-admin` diverges significantly from the rest of the monorepo's tooling standards:
1. It uses `expo lint` (ESLint) instead of the project-standard Biome.
2. It lacks a `typecheck` script in `package.json`, causing `pnpm turbo typecheck` to skip it entirely.
3. It has no configured test suite in `turbo`.
4. Manual `tsc --noEmit` reveals numerous pre-existing type errors, requiring careful diff analysis when making changes.

**Action:** When working in `apps/mobile-admin`, always run `expo lint` manually (or via `pnpm lint` in that dir) and `tsc --noEmit` locally to verify changes, as global turbo commands may give a false sense of security.
