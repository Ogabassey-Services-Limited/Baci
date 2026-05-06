# Mobile Storefront Guardrails

## Platform Drift

- Prefer shared primitives over inline platform branches.
- Add modal, sheet, picker, keyboard, safe-area, or haptic behavior through shared UI helpers whenever possible.
- Treat new `Platform.OS` and `Platform.select` usage as exceptional, not normal.
- If a new platform-specific branch is unavoidable:
  - keep the divergence local and documented with a short comment
  - update `config/platform-branch-allowlist.json`
  - run `pnpm check:platform-drift`
- Do not disable Android keyboard avoidance with an iOS-only `KeyboardAvoidingView` behavior.
- Existing iOS-only keyboard avoidance entries live in `knownForbiddenPatterns`; Phase 3, the planned Keyboard Controller migration, must drain that baseline instead of adding to it.
- If a simulator or emulator keyboard does not appear but `TextInput` focus still works, treat that as an environment/config issue first before changing app code.
- Any bug caused by iOS/Android drift must include either:
  - a regression test, or
  - a shared abstraction change that prevents the same class of bug elsewhere.

## Preferred Shared Primitives

- `components/storefront/StorefrontScreenShell.tsx`
- `hooks/use-keyboard.ts` for low-level keyboard state only
- New keyboard-aware screen/form primitives from Phase 3 once they land

Before creating a new cross-platform interaction pattern, extend an existing primitive first if it can support the use case cleanly.
