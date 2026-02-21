# Supabase Patterns

## Client Factories

Always use the correct client for the context:

```typescript
// Server-side (API routes, Server Components)
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// Client-side (Client Components)
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// Admin operations (service role — server-only, NEVER in client bundles)
import { createClient } from '@/lib/supabase/admin';
const supabase = createClient();
```

## Query Patterns

```typescript
// BAD: select('*') fetches unnecessary data
const { data } = await supabase.from('products').select('*');

// GOOD: Select only needed columns
const { data } = await supabase.from('products').select('id, name, price, image_url');
```

- Always handle `.error` on every Supabase response.
- Use `.single()` vs `.maybeSingle()` correctly.
- Scope queries to authenticated user: `.eq('merchant_id', user.id)`.

## RLS Policies

Every new table must have Row-Level Security enabled:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Merchants see only their own data
CREATE POLICY "merchants_own_data" ON table_name
  FOR ALL USING (auth.uid() = merchant_id);

-- Public storefront data (anonymous read)
CREATE POLICY "public_read" ON products
  FOR SELECT USING (true);
```

## Migrations

- Path: `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`
- Use `IF NOT EXISTS` / `IF EXISTS` for safety.
- Append-only — NEVER edit existing migration files.
- Always add indexes on foreign keys.
