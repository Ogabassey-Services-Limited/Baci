# Code Standards

## Modularization

- One component, hook, or utility per file. Max 300 lines per file.
- Extract shared logic into `packages/shared/src/`.
- Move inline Zod schemas to the `schemas/` directory.
- Consolidate duplicated patterns into shared utilities in `lib/`.
- App-specific code stays in its app (`apps/web/`, `apps/mobile-admin/`, `apps/mobile-storefront/`).

## TypeScript

- Strict mode enabled. No `any` types — use `unknown` or explicit interfaces.
- Path alias: `@/*` maps to `./src/*`.
- Use `import type { X }` for type-only imports.
- Proper generics and type narrowing over type assertions.

## React & Next.js

- Server Components by default. Add `'use client'` only when needed (hooks, interactivity). Justify every directive.
- React Compiler is enabled — automatic memoization. Never add `React.memo`, `useCallback`, or `useMemo`.
- Use `next/image` with explicit `width`/`height` or `sizes` prop.
- Include loading and error states for data-fetching components.

## Theming

- Storefront components use CSS variables (`var(--store-primary)`, etc.). Never hardcode colors.
- Color definitions in `apps/web/src/app/globals.css`.
- Use themed components from `src/components/themed/`.

## Testing

- Vitest + React Testing Library; Expo apps in `apps/mobile-*` use Jest + React Native Testing Library.
- Test files colocated with source: `MyComponent.test.tsx`.
- Test both success AND error paths.
- Use `screen.getByRole()` over `getByTestId()`.

## Quality Gate

Before submitting any changes, ALL must pass:
```bash
pnpm turbo lint        # Zero Biome errors
pnpm turbo typecheck   # Zero TypeScript errors
pnpm turbo test        # All tests pass
```

## Code Review (CodeRabbit)

Before shipping or committing, run CodeRabbit AI review:
```bash
coderabbit review --prompt-only -t uncommitted
```
- Fix all critical and high severity issues before committing.
- CodeRabbit reads your project rules automatically (CLAUDE.md, AGENTS.md).
- Use `--prompt-only` flag so output is concise and machine-readable.
