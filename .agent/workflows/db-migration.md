---
description: Create a Supabase database migration with RLS policies and proper indexes
---

# Database Migration

Create a properly structured Supabase PostgreSQL migration.

## Steps

### 1. Review Context
Check existing migrations for naming and patterns:
```bash
ls supabase/migrations/ | tail -10
```

### 2. Create Migration
Create file at `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`

### 3. Standard Patterns

**Table creation:**
```sql
CREATE TABLE IF NOT EXISTS table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  -- columns here
);

-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "merchants_own_data" ON table_name
  FOR ALL USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_table_name_merchant_id ON table_name(merchant_id);
```

### 4. Verify

- RLS enabled on all new tables
- Policies for SELECT, INSERT, UPDATE, DELETE as needed
- Indexes on foreign keys and commonly filtered columns
- Rollback instructions as SQL comments
- IF NOT EXISTS / IF EXISTS for safety
- NEVER edit existing migration files
