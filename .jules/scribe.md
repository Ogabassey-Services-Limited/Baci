2026-06-25 — [Fix Stale npm Commands in AI Context Documentation]
Learning: The AI context documentation (docs/ai/AI_CONTEXT.md) contained obsolete `npm run` commands and referenced ESLint, directly contradicting the monorepo's strict `pnpm` workspace requirement (.ruler/01-critical-rules.md) and its usage of Biome instead of ESLint (.ruler/06-architecture.md).
Action: Replace all `npm run` instances with `pnpm turbo` equivalents or `pnpm run` for scripts. Always verify command examples against monorepo architecture rules before adding or preserving them in documentation.
Source: docs/ai/AI_CONTEXT.md verified against .ruler/01-critical-rules.md and .ruler/06-architecture.md
