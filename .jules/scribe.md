2025-06-28 — [Remove Stale Genkit AI Docs]
Learning: Project documentation files (like `docs/blueprint.md` and `docs/ai/AI_CONTEXT.md`) often fail to be updated when major architectural migrations (like switching from Firebase Genkit to Vercel AI SDK) occur, leaving stale file references (`genkit.ts`) and dev commands (`npm run genkit:dev`).
Action: Use tools like `grep` to systematically track down obsolete terms after reading migration summaries to ensure documentation correctly reflects the true, current codebase and doesn't mislead agents/developers.
Source: `docs/ai/AI_MIGRATION_SUMMARY.md` vs `docs/blueprint.md` / `docs/ai/AI_CONTEXT.md`
