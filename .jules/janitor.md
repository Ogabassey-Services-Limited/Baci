## 2025-02-24 - Removed deprecated eslint-disable comments
**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise. Furthermore, some eslint-disable comments related to `require()` inline imports point to architectural refactorings (like moving to top-level or dynamic imports) that can improve code quality and maintainability.
**Action:** When finding `// eslint-disable-next-line` comments, safely remove them. If they are suppressing valid issues like inline `require()` usage, fix the underlying issue by changing it to an ES module import where appropriate before removing the comment.

## 2025-02-25 - Removed deprecated eslint-disable comments in @baci/mobile-storefront
**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise and have no effect.
**Action:** Removed useless `// eslint-disable` comments in @baci/mobile-storefront `search.tsx` and `FilterSheet.tsx` that were masking unused rules.

## 2025-02-26 - Removed debug console.log from create order form
**Learning:** Leftover `console.log` statements from development add unnecessary noise to the production codebase. They are deprecated patterns according to Janitor guidelines.
**Action:** Always verify if `console.log` statements are intended for debugging purposes and are outside of `__DEV__` blocks. If so, remove them to keep the codebase clean.
