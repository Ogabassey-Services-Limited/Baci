# Mobile Admin Guardrails

## Platform Drift

- Prefer shared primitives over inline platform branches.
- Add new modal, sheet, picker, or keyboard behavior through shared UI helpers in `components/ui/` whenever possible.
- Treat new `Platform.OS` and `Platform.select` usage as exceptional, not normal.
- If a new platform-specific branch is unavoidable:
  - keep the divergence local and documented with a short comment
  - update `config/platform-branch-allowlist.json`
  - run `pnpm check:platform-drift`
- Do not disable Android keyboard avoidance with an iOS-only `KeyboardAvoidingView` behavior.
- Any bug caused by iOS/Android drift must include either:
  - a regression test, or
  - a shared abstraction change that prevents the same class of bug elsewhere.

## Preferred Shared Primitives

- `components/ui/CountryPickerModal.tsx`
- `components/ui/ReceiptPreviewModal.tsx`
- `components/ui/StatusModal.tsx`
- `components/ui/SuccessModal.tsx`

Before creating a new cross-platform interaction pattern, extend an existing primitive first if it can support the use case cleanly.
