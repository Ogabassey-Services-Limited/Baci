-- Add fulfillment_details column to orders table
-- This stores IMEI/serial numbers when gadget orders are marked as shipped
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_details JSONB;

COMMENT ON COLUMN orders.fulfillment_details IS 'Stores fulfillment metadata like IMEI, serial numbers for electronics orders';
