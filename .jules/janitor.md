## 2025-02-24 - Removed deprecated eslint-disable comments
**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise. Furthermore, some eslint-disable comments related to `require()` inline imports point to architectural refactorings (like moving to top-level or dynamic imports) that can improve code quality and maintainability.
**Action:** When finding `// eslint-disable-next-line` comments, safely remove them. If they are suppressing valid issues like inline `require()` usage, fix the underlying issue by changing it to an ES module import where appropriate before removing the comment.

## 2025-02-25 - Removed deprecated eslint-disable comments in @baci/mobile-storefront
**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise and have no effect.
**Action:** Removed useless `// eslint-disable` comments in @baci/mobile-storefront `search.tsx` and `FilterSheet.tsx` that were masking unused rules.

## 2025-02-27 - Removed widespread eslint-disable comments related to require imports
**Learning:** Found numerous `// eslint-disable-next-line @typescript-eslint/no-require-imports` in the `@baci/mobile-storefront` workspace, particularly in test files and config files. Since Biome is the linter, these are deprecated and unnecessary noise.
**Action:** When performing codebase hygiene, sweep for unused `eslint-disable` directives. Using tools like `sed` makes mass removal efficient, but verify afterwards with `pnpm turbo lint` or `pnpm exec biome check` to confirm no new regressions. Also ensure testing remains green.
