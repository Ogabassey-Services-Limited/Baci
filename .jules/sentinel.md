## 2025-02-28 — Unscoped Bulk Upsert Enables Cross-Tenant Data Overwrite
**Vulnerability:** Broken Access Control / IDOR (OWASP A01:2021) / CWE-284
**Learning:** Supabase `upsert` cannot securely accept `.eq('merchant_id', ...)` filters to restrict updates to the current tenant. Passing an array containing `{ id: <victim-id>, merchant_id: <attacker-id>, ... }` to `upsert()` causes the database to match the primary key and execute an overwrite, transferring ownership to the attacker.
**Prevention:** Avoid unscoped array `upsert()` for tenant-isolated mutations. Instead, use `Promise.all()` to map over items and execute individual `.update()` operations explicitly chained with `.eq('merchant_id', merchantId)` and `.eq('id', item.id)`.
**Source:** Supabase Security Documentation / RLS and Upsert mechanics.
