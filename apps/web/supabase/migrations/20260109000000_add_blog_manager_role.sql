-- Migration: Add Blog Manager Role
-- Created: 2026-01-09
-- Description: Adds 'blog_manager' to staff_role enum and sets default permissions

-- Step 1: Add new value to enum
-- Note: 'ALTER TYPE ... ADD VALUE' cannot be wrapped in a transaction block
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'blog_manager';

-- Step 2: Insert default permissions for blog_manager
INSERT INTO role_permissions (role, permissions) VALUES
  ('blog_manager', '{
    "dashboard": {"view": true},
    "orders": {"view": false},
    "products": {"view": true},
    "customers": {"view": false},
    "analytics": {"view": true},
    "marketing": {"view": true, "create": true, "edit": true, "delete": true},
    "settings": {"view": false},
    "staff": {"view": false},
    "integrations": {"view": false},
    "pages": {"view": true, "edit": true},
    "builder": {"view": true, "edit": true}
  }')
ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;
