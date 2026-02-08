Create a Supabase database migration for the requested change.

Requirements:
1. Review existing migrations in supabase/migrations/ for context and naming
2. Create a properly named migration: YYYYMMDDHHMMSS_descriptive_name.sql
3. Use IF NOT EXISTS / IF EXISTS for safety
4. Include RLS policies for any new tables
5. Add indexes on foreign keys and commonly filtered columns
6. Include rollback instructions as SQL comments
7. Never edit existing migration files

Standard patterns:
- UUID primary keys with gen_random_uuid()
- created_at/updated_at with DEFAULT now()
- Soft deletes with deleted_at column where appropriate
- JSONB for flexible metadata

The migration should: $ARGUMENTS

After creating, suggest running `mcp__supabase__get_advisors` for security check.
