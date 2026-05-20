# Testing & Modularity Enforcement

## Mandatory Test Coverage

Every new or significantly modified file MUST have a colocated test file:

| Source File | Test File |
|-------------|-----------|
| `MyComponent.tsx` | `MyComponent.test.tsx` |
| `useMyHook.ts` | `useMyHook.test.ts` |
| `my-util.ts` | `my-util.test.ts` |
| `route.ts` (API) | `route.test.ts` |
| `my-schema.ts` (Zod) | `my-schema.test.ts` |

### What Requires Tests

- **New components** — render, interactions, loading/error states
- **New hooks** — state transitions, error handling, context integration
- **New utilities/helpers** — all input variations, edge cases
- **New API routes** — auth (401), validation (400), success (200), errors (500)
- **New Zod schemas** — valid parsing, each validation rule, boundary values
- **Bug fixes** — a regression test proving the fix works (see Regression Tests section below)

### What Does NOT Require Tests

- Pure type files (`types/*.ts`) with no runtime logic
- Configuration files (`config/*.ts`) that only export constants
- Re-export barrel files (`index.ts`)
- CSS/style-only changes
- Documentation-only changes

## Test Quality Standards

- **AAA pattern**: Arrange, Act, Assert — in that order, clearly separated
- **Descriptive names**: `it('returns 401 when user is not authenticated')` not `it('works')`
- **Both paths**: Every test suite covers success AND error/edge cases
- **No implementation details**: Test behavior, not internal state or method calls
- **No flaky tests**: No `setTimeout`, no random data, no network calls without mocks
- **Prefer role queries**: `screen.getByRole('button', { name: 'Submit' })` over `getByTestId`

## Regression Tests (Bug Fixes)

**MANDATORY**: Every bug fix MUST include a regression test. Regression tests differ from feature tests — they prove a specific bug cannot recur.

### Requirements

1. **Reproduce first** — Write a test that would FAIL against the buggy code, proving the bug exists.
2. **Pass after fix** — The same test PASSES once the fix is applied.
3. **Target the exact condition** — Test the specific input, state, or edge case that triggered the bug. Keep it minimal.
4. **Descriptive naming** — Include bug context in the test name:
   - `it('does not crash when product price is zero')`
   - `it('handles empty merchant_id without throwing')`
   - `it('sanitizes script tags in SVG receipt content')`

### Structure

```typescript
describe('bugfix: [brief description of what was broken]', () => {
  it('[correct behavior] when [condition that triggered the bug]', () => {
    // Arrange: Set up the exact conditions that triggered the bug
    const input = { price: 0, quantity: 1 }; // the edge case

    // Act: Perform the action that previously failed
    const result = calculateTotal(input);

    // Assert: Verify correct behavior (not the old broken behavior)
    expect(result).toBe(0);
  });
});
```

### Feature Tests vs Regression Tests

| | Feature Tests | Regression Tests |
|---|---|---|
| **When** | Writing new code or adding functionality | Fixing a bug |
| **Purpose** | Verify new behavior works as designed | Verify a specific bug does NOT recur |
| **Scope** | Broad — cover happy path, edge cases, error states | Narrow — test only the exact failing scenario |
| **Naming** | Describes expected behavior | Describes what was broken and is now fixed |
| **Required for** | New components, hooks, utils, API routes, schemas | Every bug fix, no matter how small |

### Anti-Patterns

```typescript
// BAD: Regression test that doesn't test the actual bug condition
it('works correctly', () => {
  expect(calculateTotal({ price: 10, quantity: 2 })).toBe(20); // normal case, not the bug
});

// GOOD: Regression test targeting the exact edge case
it('returns 0 when price is zero instead of NaN', () => {
  expect(calculateTotal({ price: 0, quantity: 5 })).toBe(0); // the actual bug condition
});
```

## Modularity Rules

These rules apply to ALL code written by ANY agent:

- **One export per file**: Each file has a single primary export (component, hook, utility, schema)
- **Max 300 lines**: If a file exceeds 300 lines, split it. Extract sub-components, helpers, or constants
- **No God components**: A component doing 3+ unrelated things must be split
- **Shared logic → packages/shared/**: If 2+ apps use the same logic, extract it
- **Schemas → schemas/ directory**: No inline Zod schemas in components or API routes
- **Constants → dedicated files**: No magic strings/numbers. Extract to `config/` or `constants/`
- **Hooks for side effects**: Complex `useEffect` logic should be extracted into custom hooks

## Pre-Completion Checklist

Before marking any task as complete, verify:

1. New source files have colocated test files
2. Tests pass: `pnpm turbo test`
3. No files exceed 300 lines
4. No duplicated logic across files (extract to shared)
5. All exports are typed (no implicit `any`)

## Android Emulator QA

For `apps/mobile-admin`, Android emulator QA must start from:

```bash
pnpm --filter baci-mobile-admin android:emulator
```

This is the only supported emulator launch path for agents and automation. Do not launch the emulator directly or with `-gpu swiftshader_indirect`; the repo launcher owns GPU mode, Quick Boot, ADB reset, boot waiting, Android settle checks, the Metro ADB reverse, and ADB shell stability checks.
Run Metro for Android with `pnpm --filter baci-mobile-admin android:metro`; do not use a localhost-only Metro host for emulator QA because the dev client connects through `10.0.2.2`.
Launch the Android dev client with `pnpm --filter baci-mobile-admin android:launch`; do not use raw `adb shell am start` commands because the repo launcher owns the Metro reverse, settled-load check, package force-stop, and Expo dev-client URL.
