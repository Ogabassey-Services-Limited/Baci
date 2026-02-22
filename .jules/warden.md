# Warden's Journal

## 2026-02-19 - [Over-fetching in Products API]

**Learning:** Found 'select(*)' in critical products endpoint, exposing all columns including potentially deprecated ones.
**Action:** Replaced wildcard with explicit column list to prevent over-fetching and adhere to Warden's strict data integrity rules.
