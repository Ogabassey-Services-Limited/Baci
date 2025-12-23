-- Fix Extension Schema Warnings
-- Move extensions from public to extensions schema
-- This is safe because 'extensions' is already in the search_path

-- Move vector extension
ALTER EXTENSION vector SET SCHEMA extensions;

-- Move pg_trgm extension
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
