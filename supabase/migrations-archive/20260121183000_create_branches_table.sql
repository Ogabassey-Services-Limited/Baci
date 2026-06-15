-- Migration: Create branches table for multi-location management
-- This table enables merchants to organize their business by physical locations

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  manager_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for merchant lookups
CREATE INDEX idx_branches_merchant_id ON branches(merchant_id);

-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Merchants can view/manage their own branches
CREATE POLICY "Merchants can view own branches" ON branches
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM merchants WHERE id = branches.merchant_id
    )
  );

CREATE POLICY "Merchants can insert own branches" ON branches
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM merchants WHERE id = merchant_id
    )
  );

CREATE POLICY "Merchants can update own branches" ON branches
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM merchants WHERE id = branches.merchant_id
    )
  );

CREATE POLICY "Merchants can delete own branches" ON branches
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM merchants WHERE id = branches.merchant_id
    )
  );

-- Staff members can view branches they have access to
CREATE POLICY "Staff can view merchant branches" ON branches
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM staff_members WHERE merchant_id = branches.merchant_id
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branches_updated_at();

-- Create a default branch for existing merchants (optional - run manually if needed)
-- INSERT INTO branches (merchant_id, name, is_default)
-- SELECT id, 'Main Branch', true FROM merchants WHERE NOT EXISTS (
--   SELECT 1 FROM branches WHERE merchant_id = merchants.id
-- );
