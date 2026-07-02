## 2025-02-24 - Removed deprecated eslint-disable comments

**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise. Furthermore, some eslint-disable comments related to `require()` inline imports point to architectural refactorings (like moving to top-level or dynamic imports) that can improve code quality and maintainability.
**Action:** When finding `// eslint-disable-next-line` comments, safely remove them. If they are suppressing valid issues like inline `require()` usage, fix the underlying issue by changing it to an ES module import where appropriate before removing the comment.

## 2025-02-25 - Removed deprecated eslint-disable comments in @baci/mobile-storefront

**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise and have no effect.
**Action:** Removed useless `// eslint-disable` comments in @baci/mobile-storefront `search.tsx` and `FilterSheet.tsx` that were masking unused rules.

## 2026-06-12 - Removed redundant eslint-disable comment in mobile-admin negotiations

**Learning:** Biome is the exclusive linter in the Baci monorepo. The `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise and have no effect. In `negotiations.tsx`, the exhaustive-deps rule was already properly disabled using the correct `// biome-ignore` syntax, making the legacy eslint-disable comment completely redundant and confusing.
**Action:** Removed useless `// eslint-disable-next-line react-hooks/exhaustive-deps` comment in `@baci/mobile-admin`'s `negotiations.tsx`. When migrating to Biome, always ensure legacy eslint directives are completely stripped, especially when their equivalent Biome suppressions have already been added.

## 2026-06-28 — Remove dead auth helpers only after current-main grep

**Learning:** Stale branches can remove too much around middleware/proxy. For dead-code janitor work, re-run `git grep` on current main and cherry-pick only the unused symbol removal.
**Action:** Remove unused helpers only when no current-main imports, dynamic references, or route hooks remain.
**Source:** Current-main grep plus existing Next proxy ownership, verified 2026-06-28.
