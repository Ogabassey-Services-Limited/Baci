-- Migration: Staff/Team Members System
-- Created: 2025-11-28
-- Description: Add staff management with role-based permissions for merchants

-- =============================================================================
-- STEP 1: Create enum for predefined staff roles
-- =============================================================================

CREATE TYPE staff_role AS ENUM (
  'admin',           -- Full access (like store owner, but not the owner)
  'manager',         -- Can manage orders, products, customers, but not settings/billing
  'sales_rep',       -- Can view/manage orders and customers
  'inventory',       -- Can manage products and inventory only
  'accountant',      -- Can view orders, reports, and financial data (read-only mostly)
  'customer_service', -- Can view/manage orders and customers, handle support
  'marketing',       -- Can manage marketing, discount codes, and content
  'fulfillment'      -- Can manage order fulfillment and shipping only
);

-- =============================================================================
-- STEP 2: Create staff_members table
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL until invitation accepted
  email TEXT NOT NULL,
  name TEXT,
  role staff_role NOT NULL DEFAULT 'sales_rep',

  -- Granular permissions (overrides role defaults if set)
  permissions JSONB DEFAULT '{}',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),

  -- Invitation tracking
  invitation_token TEXT,
  invitation_expires_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Metadata
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(merchant_id, email),
  UNIQUE(invitation_token)
);

-- Create indexes for performance
CREATE INDEX idx_staff_members_merchant ON staff_members(merchant_id);
CREATE INDEX idx_staff_members_user ON staff_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_staff_members_email ON staff_members(email);
CREATE INDEX idx_staff_members_token ON staff_members(invitation_token) WHERE invitation_token IS NOT NULL;

-- =============================================================================
-- STEP 3: Create role_permissions table for default permissions per role
-- =============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role staff_role PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '{}'
);

-- Insert default permissions for each role
INSERT INTO role_permissions (role, permissions) VALUES
  ('admin', '{
    "dashboard": {"view": true},
    "orders": {"view": true, "create": true, "edit": true, "delete": true, "fulfill": true, "refund": true},
    "products": {"view": true, "create": true, "edit": true, "delete": true, "manage_inventory": true},
    "customers": {"view": true, "create": true, "edit": true, "delete": true},
    "analytics": {"view": true, "export": true},
    "marketing": {"view": true, "create": true, "edit": true, "delete": true},
    "settings": {"view": true, "edit": true},
    "staff": {"view": true, "invite": true, "edit": true, "remove": true},
    "integrations": {"view": true, "manage": true},
    "pages": {"view": true, "edit": true},
    "builder": {"view": true, "edit": true}
  }'),
  ('manager', '{
    "dashboard": {"view": true},
    "orders": {"view": true, "create": true, "edit": true, "fulfill": true, "refund": true},
    "products": {"view": true, "create": true, "edit": true, "delete": true, "manage_inventory": true},
    "customers": {"view": true, "create": true, "edit": true},
    "analytics": {"view": true, "export": true},
    "marketing": {"view": true, "create": true, "edit": true, "delete": true},
    "settings": {"view": true},
    "staff": {"view": true},
    "integrations": {"view": true},
    "pages": {"view": true, "edit": true},
    "builder": {"view": true, "edit": true}
  }'),
  ('sales_rep', '{
    "dashboard": {"view": true},
    "orders": {"view": true, "create": true, "edit": true},
    "products": {"view": true},
    "customers": {"view": true, "create": true, "edit": true},
    "analytics": {"view": false},
    "marketing": {"view": true},
    "settings": {"view": false},
    "staff": {"view": false},
    "integrations": {"view": false},
    "pages": {"view": false},
    "builder": {"view": false}
  }'),
  ('inventory', '{
    "dashboard": {"view": true},
    "orders": {"view": true},
    "products": {"view": true, "create": true, "edit": true, "manage_inventory": true},
    "customers": {"view": false},
    "analytics": {"view": false},
    "marketing": {"view": false},
    "settings": {"view": false},
    "staff": {"view": false},
    "integrations": {"view": false},
    "pages": {"view": false},
    "builder": {"view": false}
  }'),
  ('accountant', '{
    "dashboard": {"view": true},
    "orders": {"view": true},
    "products": {"view": true},
    "customers": {"view": true},
    "analytics": {"view": true, "export": true},
    "marketing": {"view": true},
    "settings": {"view": false},
    "staff": {"view": false},
    "integrations": {"view": false},
    "pages": {"view": false},
    "builder": {"view": false}
  }'),
  ('customer_service', '{
    "dashboard": {"view": true},
    "orders": {"view": true, "edit": true, "fulfill": true},
    "products": {"view": true},
    "customers": {"view": true, "create": true, "edit": true},
    "analytics": {"view": false},
    "marketing": {"view": false},
    "settings": {"view": false},
    "staff": {"view": false},
    "integrations": {"view": false},
    "pages": {"view": false},
    "builder": {"view": false}
  }'),
  ('marketing', '{
    "dashboard": {"view": true},
    "orders": {"view": true},
    "products": {"view": true, "edit": true},
    "customers": {"view": true},
    "analytics": {"view": true},
    "marketing": {"view": true, "create": true, "edit": true, "delete": true},
    "settings": {"view": false},
    "staff": {"view": false},
    "integrations": {"view": true},
    "pages": {"view": true, "edit": true},
    "builder": {"view": true, "edit": true}
  }'),
  ('fulfillment', '{
    "dashboard": {"view": true},
    "orders": {"view": true, "fulfill": true},
    "products": {"view": true, "manage_inventory": true},
    "customers": {"view": true},
    "analytics": {"view": false},
    "marketing": {"view": false},
    "settings": {"view": false},
    "staff": {"view": false},
    "integrations": {"view": false},
    "pages": {"view": false},
    "builder": {"view": false}
  }')
ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;

-- =============================================================================
-- STEP 4: Create helper function to get effective permissions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_staff_permissions(p_staff_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_role staff_role;
  v_custom_permissions JSONB;
  v_default_permissions JSONB;
BEGIN
  -- Get staff member's role and custom permissions
  SELECT role, permissions INTO v_role, v_custom_permissions
  FROM staff_members WHERE id = p_staff_id;

  IF v_role IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;

  -- Get default permissions for role
  SELECT permissions INTO v_default_permissions
  FROM role_permissions WHERE role = v_role;

  -- Merge: custom permissions override defaults
  RETURN COALESCE(v_default_permissions, '{}'::JSONB) || COALESCE(v_custom_permissions, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 5: Create function to check if user has permission
-- =============================================================================

CREATE OR REPLACE FUNCTION check_staff_permission(
  p_user_id UUID,
  p_merchant_id UUID,
  p_resource TEXT,
  p_action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_staff_permissions JSONB;
BEGIN
  -- Check if user is the merchant owner (full access)
  SELECT EXISTS(
    SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = p_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN TRUE;
  END IF;

  -- Check staff permissions
  SELECT get_staff_permissions(sm.id) INTO v_staff_permissions
  FROM staff_members sm
  WHERE sm.merchant_id = p_merchant_id
    AND sm.user_id = p_user_id
    AND sm.status = 'active';

  IF v_staff_permissions IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check specific permission
  RETURN COALESCE(
    (v_staff_permissions -> p_resource ->> p_action)::BOOLEAN,
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 6: Create function to get user's merchant access
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_merchant_access(p_user_id UUID)
RETURNS TABLE (
  merchant_id UUID,
  merchant_name TEXT,
  is_owner BOOLEAN,
  role staff_role,
  permissions JSONB
) AS $$
BEGIN
  -- Return merchants where user is owner
  RETURN QUERY
  SELECT
    m.id as merchant_id,
    m.business_name as merchant_name,
    TRUE as is_owner,
    NULL::staff_role as role,
    '{"full_access": true}'::JSONB as permissions
  FROM merchants m
  WHERE m.user_id = p_user_id;

  -- Return merchants where user is staff
  RETURN QUERY
  SELECT
    sm.merchant_id,
    m.business_name as merchant_name,
    FALSE as is_owner,
    sm.role,
    get_staff_permissions(sm.id) as permissions
  FROM staff_members sm
  JOIN merchants m ON m.id = sm.merchant_id
  WHERE sm.user_id = p_user_id AND sm.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: RLS Policies for staff_members table
-- =============================================================================

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own staff
CREATE POLICY "Merchants can view own staff" ON staff_members
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Merchants can insert staff (invite)
CREATE POLICY "Merchants can invite staff" ON staff_members
  FOR INSERT WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Merchants can update their staff
CREATE POLICY "Merchants can update own staff" ON staff_members
  FOR UPDATE USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Merchants can delete their staff
CREATE POLICY "Merchants can delete own staff" ON staff_members
  FOR DELETE USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- =============================================================================
-- STEP 8: Update trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_staff_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_members_updated_at
  BEFORE UPDATE ON staff_members
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_members_updated_at();

-- =============================================================================
-- STEP 9: Add comments for documentation
-- =============================================================================

COMMENT ON TABLE staff_members IS 'Staff/team members for merchants with role-based access';
COMMENT ON TABLE role_permissions IS 'Default permission sets for each staff role';
COMMENT ON FUNCTION get_staff_permissions IS 'Returns effective permissions for a staff member (role defaults + custom overrides)';
COMMENT ON FUNCTION check_staff_permission IS 'Checks if a user has a specific permission for a merchant';
COMMENT ON FUNCTION get_user_merchant_access IS 'Returns all merchants a user has access to (as owner or staff)';

COMMENT ON COLUMN staff_members.permissions IS 'Custom permission overrides (merged with role defaults)';
COMMENT ON COLUMN staff_members.status IS 'pending = invited but not accepted, active = can access, suspended = temporarily disabled, removed = soft deleted';
