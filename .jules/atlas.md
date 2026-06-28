# Atlas Notes

## 2026-06-28 — Shared Intl currency formatting for mobile admin totals
**Learning:** `Intl.NumberFormat` should be the shared source for currency display so locale, symbol placement, grouping, and fallback behavior stay consistent across markets. Avoid isolated `en-NG` formatter caches in components/helpers.
**Action:** Route mobile-admin totals through the shared `formatCurrency` utility and validate merchant currency codes before formatting.
**Source:** MDN Intl.NumberFormat docs and Baci mobile-admin currency utilities, verified 2026-06-28.
