-- Add Virtual Terminal support to merchants table
-- This migration adds the virtual_terminal_code column to track each merchant's terminal

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS virtual_terminal_code TEXT;

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_merchants_virtual_terminal_code 
  ON merchants(virtual_terminal_code) 
  WHERE virtual_terminal_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN merchants.virtual_terminal_code IS 
  'Paystack Virtual Terminal code (VT_XXXXX) for WhatsApp payment notifications';
