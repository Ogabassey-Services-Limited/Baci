2025-10-31 — AI Migration Documentation Fix
Learning: The AI implementation migrated from Firebase Genkit to Vercel AI SDK, but AI_CONTEXT.md and blueprint.md contained stale documentation and commands (npm run genkit:dev) for the old engine.
Action: Remove obsolete references to genkit:dev and update the AI engine description to reflect the Vercel AI SDK.
Source: docs/ai/AI_CONTEXT.md and apps/web/src/ai/provider.ts
