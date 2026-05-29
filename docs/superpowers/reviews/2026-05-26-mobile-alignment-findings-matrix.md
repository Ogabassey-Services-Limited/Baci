# Mobile Alignment Findings Matrix (2026-05-26)

## Findings Status

| Area | Finding | Status | Evidence |
|---|---|---|---|
| mobile-admin/paywall | stale `error` closure on purchase success fallback | fixed | `apps/mobile-admin/components/paywall/Paywall.tsx`, `apps/mobile-admin/components/paywall/Paywall.test.tsx` |
| mobile-admin/domains | sheet exit sequencing snap | fixed | `apps/mobile-admin/components/domains/DomainOptionsSheet.tsx`, `apps/mobile-admin/components/domains/DomainOptionsSheet.test.tsx` |
| mobile-admin/drift script | import regex blind spot | fixed | `apps/mobile-admin/scripts/check-platform-drift.mjs`, `apps/mobile-admin/scripts/check-platform-drift.test.ts` |
| storefront/drift | alias/destructure Platform branch blind spots | fixed | `apps/mobile-storefront/scripts/check-platform-drift.mjs`, `apps/mobile-storefront/scripts/check-platform-drift.test.ts` |
| storefront/modularity | active size debt in route/module baselines | open | `apps/mobile-storefront/config/route-size-baseline.json`, `apps/mobile-storefront/config/module-size-baseline.json` |

## Verification Evidence (2026-05-27)

### `pnpm --filter baci-mobile-admin test components/paywall/Paywall.test.tsx`

```text
Test Files  1 passed (1)
Tests       7 passed (7)
```

### `pnpm --filter baci-mobile-admin test components/domains/DomainOptionsSheet.test.tsx`

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

### `pnpm --filter baci-mobile-admin test scripts/check-platform-drift.test.ts`

```text
Test Files  1 passed (1)
Tests      13 passed (13)
```

### `pnpm --filter baci-mobile-admin check:platform-drift`

```text
[platform-drift] OK: 1 allowlisted platform-specific files, no forbidden drift patterns found.
```

### `pnpm --filter @baci/mobile-storefront check:platform-drift`

```text
[platform-drift] OK: 50 allowlisted platform-specific files, 0 known forbidden pattern baselines, no new forbidden drift patterns found.
```

### `pnpm --filter @baci/mobile-storefront check:route-size`

```text
[route-size] OK: 0 oversized route baselines within the decreasing 300-line budget.
```

### `pnpm --filter @baci/mobile-storefront check:module-size`

```text
[module-size] OK: 15 oversized module baselines within the decreasing 300-line budget.
```

## Current Gap Snapshot

- Route-size baseline debt: `0` files
- Module-size baseline debt: `23` files
- Required next action: continue Slice E decomposition until the module baseline list is empty
