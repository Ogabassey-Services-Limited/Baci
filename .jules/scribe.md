2026-06-23 — Docs Command Consistency
Learning: Replaced legacy `npm run <command>` commands across docs (`docs/blueprint.md`, `docs/ai/AI_CONTEXT.md`, `docs/guides/ORDERS_INTEGRATION_GUIDE.md`, etc.) with correct `pnpm turbo <command>` per the monorepo config. Also updated `npm install` instances.
Action: Search and replace outdated node package manager commands inside `.ruler` and `docs` when encountered.
Source: `package.json` explicitly mandates `pnpm@11.7.0` and `.ruler/01-critical-rules.md` explicitly bans `npm` or `yarn`.
