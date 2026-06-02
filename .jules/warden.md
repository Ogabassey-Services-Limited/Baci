## 2025-05-18 - Missing Tenant Isolation in Order Updates
**Learning:** Even when modifying data derived from a known entity (like an `order_id`), Supabase `.update()` calls can act as IDOR (Insecure Direct Object Reference) vectors if not explicitly scoped by `merchant_id`. In `record-payment`, the order status was being updated purely by `id`, which could allow a malicious user to modify another tenant's order status if they guess the ID.
**Action:** ALWAYS chain `.eq('merchant_id', merchantId)` onto database mutations (`.update()`, `.delete()`), even when selecting by the record's primary key (`.eq('id', id)`). This ensures defense-in-depth against cross-tenant data modification.

## 2025-05-18 - Missing Tenant Isolation in Order Updates
**Learning:** Even when modifying data derived from a known entity (like an `order_id`), Supabase `.update()` calls can act as IDOR (Insecure Direct Object Reference) vectors if not explicitly scoped by `merchant_id`. In `record-payment`, the order status was being updated purely by `id`, which could allow a malicious user to modify another tenant's order status if they guess the ID.
**Action:** ALWAYS chain `.eq('merchant_id', merchantId)` onto database mutations (`.update()`, `.delete()`), even when selecting by the record's primary key (`.eq('id', id)`). This ensures defense-in-depth against cross-tenant data modification.
