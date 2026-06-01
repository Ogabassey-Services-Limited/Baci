## 2025-02-24 - Removed deprecated eslint-disable comments
**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise. Furthermore, some eslint-disable comments related to `require()` inline imports point to architectural refactorings (like moving to top-level or dynamic imports) that can improve code quality and maintainability.
**Action:** When finding `// eslint-disable-next-line` comments, safely remove them. If they are suppressing valid issues like inline `require()` usage, fix the underlying issue by changing it to an ES module import where appropriate before removing the comment.

## 2025-02-25 - Removed deprecated eslint-disable comments in @baci/mobile-storefront
**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise and have no effect.
**Action:** Removed useless `// eslint-disable` comments in @baci/mobile-storefront `search.tsx` and `FilterSheet.tsx` that were masking unused rules.

## 2025-02-26 - Cleaned up obsolete eslint-disable comments in @baci/mobile-storefront tests and UI components
**Learning:** Found several `// eslint-disable-next-line @typescript-eslint/no-require-imports` comments across the mobile storefront app, particularly in tests mocking `react-native-reanimated` and in `clipboard.ts`. Since the monorepo uses Biome exclusively, these ESLint directives are dead code that only add noise. Removing them does not trigger Biome errors because Biome has different rules or configurations.
**Action:** Removed the obsolete ESLint comments from UI components and tests. Always verify the actual linter (Biome) output before and after removing such directives.
