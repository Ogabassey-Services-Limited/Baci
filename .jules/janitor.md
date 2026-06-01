## 2025-02-24 - Removed deprecated eslint-disable comments
**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise. Furthermore, some eslint-disable comments related to `require()` inline imports point to architectural refactorings (like moving to top-level or dynamic imports) that can improve code quality and maintainability.
**Action:** When finding `// eslint-disable-next-line` comments, safely remove them. If they are suppressing valid issues like inline `require()` usage, fix the underlying issue by changing it to an ES module import where appropriate before removing the comment.

## 2025-02-25 - Removed deprecated eslint-disable comments in @baci/mobile-storefront
**Learning:** Biome is the exclusive linter in the Baci monorepo. `// eslint-disable` comments are dead code/deprecated anti-patterns that add noise and have no effect.
**Action:** Removed useless `// eslint-disable` comments in @baci/mobile-storefront `search.tsx` and `FilterSheet.tsx` that were masking unused rules.

## 2025-02-26 - Cleaned up obsolete eslint-disable comments in @baci/mobile-storefront tests and UI components
**Learning:** Found several `// eslint-disable-next-line @typescript-eslint/no-require-imports` comments across the mobile storefront app, particularly in tests mocking `react-native-reanimated` and in `clipboard.ts`. Since the monorepo uses Biome exclusively, these ESLint directives are dead code that only add noise. Removing them does not trigger Biome errors because Biome has different rules or configurations.
**Action:** Removed the obsolete ESLint comments from UI components and tests. Always verify the actual linter (Biome) output before and after removing such directives.

## 2025-02-26 - Reverted removing inline require logic inside DEV checks
**Learning:** React Native's Metro bundler does not tree-shake unused static imports. So converting an inline `require` inside a `__DEV__` check into a top-level static `import` or static assignment means the mocked fixture data will now be bundled in production apps!
**Action:** Always maintain the inline `require` structure inside development blocks to ensure mocked fixture data is not permanently bundled. You can remove only the surrounding `// eslint-disable-next-line @typescript-eslint/no-require-imports` directives. In cases where tests depend on `style: any` to cast React Native styles, reverting those casts to `any` while still keeping the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment is valid as they are just test helpers.

## 2025-02-26 - Restored proper explicit types for React Native Animated styles
**Learning:** You cannot just cast `react-native-reanimated`'s `AnimatedStyle<ViewStyle>` output to `Record<string, unknown>` or `{ opacity?: number }` in test helpers since they return strict shapes like `ViewStyle & Partial<CSSAnimationProperties>`. Typecasting via `any` inside tests is an allowed workaround if it's the only way to inspect nested transform properties reliably.
**Action:** Retain `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for complex Reanimated test helpers, avoiding deep interface extraction for properties like `transform[0].translateY`.

## 2025-02-26 - Reverted removing inline require logic inside DEV checks
**Learning:** React Native's Metro bundler does not tree-shake unused static imports. So converting an inline `require` inside a `__DEV__` check into a top-level static `import` or static assignment means the mocked fixture data will now be permanently bundled in production apps!
**Action:** Always maintain the inline `require` structure inside development blocks to ensure mocked fixture data is not permanently bundled. You can remove only the surrounding `// eslint-disable-next-line @typescript-eslint/no-require-imports` directives. In cases where tests depend on `style: any` to cast React Native styles, reverting those casts to `any` while still keeping the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment is valid as they are just test helpers.
