YYYY-MM-DD — Route new-order-totals currency through shared utility
Learning: The `en-NG` literal was hidden within an isolated formatter cache in `new-order-totals.ts`.
Action: Replaced it with the shared utility `formatCurrency` to remove the localization debt while preserving the performance cache and behavior.
Source: apps/mobile-admin/lib/new-order-totals.ts
