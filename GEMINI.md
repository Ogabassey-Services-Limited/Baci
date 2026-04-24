# Gemini Review Guidance

This file gives Gemini the repository constraints it must follow when reviewing pull requests in Baci.

## Review focus

- Prioritize correctness, regressions, security, data safety, and missing tests.
- Prefer a small number of high-signal findings over broad style commentary.
- Call out behavior changes and production risk clearly.

## Repository rules

- This is a pnpm monorepo. Use `pnpm` and `pnpm turbo` only.
- Biome is the linter and formatter. Do not introduce ESLint.
- React Compiler is enabled. Do not suggest `React.memo`, `useMemo`, or `useCallback` by default.
- Do not modify `proxy.ts` or `src/config/business-types.ts` without explicit approval.
- Existing `supabase/migrations/` files are append-only.
- Avoid `any`; prefer explicit types or `unknown`.
- Validate API inputs with Zod and keep protected routes auth-first.
- Do not use `select('*')` in Supabase queries.

## Architecture notes

- `apps/web/` is the Next.js 16 app for the builder and storefronts.
- `apps/mobile-admin/` and `apps/mobile-storefront/` are Expo apps.
- Shared logic belongs in `packages/shared/` when multiple apps depend on it.
- Storefront theming should rely on CSS variables and existing themed components.

## Risk hotspots

- Payments and webhook handlers need extra scrutiny.
- Multi-tenant routing, auth, and domain logic are sensitive.
- Storefront performance matters. Flag avoidable client-side bloat or heavy dependencies.

## Review style

- Keep comments concise and actionable.
- Mention missing regression tests when a bug fix changes runtime behavior.
- Prefer concrete file and behavior references over generic advice.
