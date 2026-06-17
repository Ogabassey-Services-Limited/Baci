## 2025-02-18 — Use verified tokens even if excluded from partial prompt lists
**Learning:** The prompt may list a partial set of tokens (e.g. `text`, `primary`, etc.) and warn against inventing tokens, leading automated reviewers to flag valid tokens like `textOnPrimary` as hallucinated if not in that specific list.
**Action:** Always `grep` or `cat` the actual `constants/theme.ts` file to definitively prove a token exists (like `textOnPrimary`) and ignore incomplete lists in the prompt when the source code proves otherwise.
**Source:** `apps/mobile-admin/constants/theme.ts`
