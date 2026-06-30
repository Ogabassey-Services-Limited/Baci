2024-03-24 — Extract hardcoded Intl.NumberFormat
Learning: Found a hardcoded Intl.NumberFormat('en-NG') instance in the purchase history page.
Action: Replaced with the centralized `useCurrency` hook.
Source: apps/web/src/components/storefront/ogabassey/pages/purchase-history.tsx
