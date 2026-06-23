2026-06-23 — Docs Command Consistency
Learning: Replaced legacy package-manager commands across docs (`docs/blueprint.md`, `docs/ai/AI_CONTEXT.md`, `docs/guides/ORDERS_INTEGRATION_GUIDE.md`, etc.) with repo-valid `pnpm turbo`, `pnpm --filter`, and `pnpm dlx` equivalents per the monorepo config. Also updated package install examples.
Action: Search and replace outdated node package manager commands inside `.ruler` and `docs` when encountered.
Source: `package.json` explicitly mandates `pnpm@11.7.0` and `.ruler/01-critical-rules.md` explicitly bans `npm` or `yarn`.
