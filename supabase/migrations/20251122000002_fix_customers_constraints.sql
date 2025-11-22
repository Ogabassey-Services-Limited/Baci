-- Make full_name nullable since we're using first_name and last_name
ALTER TABLE customers 
  ALTER COLUMN full_name DROP NOT NULL;

-- Create a function to auto-populate full_name from first_name and last_name
CREATE OR REPLACE FUNCTION update_customer_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update full_name on insert or update
DROP TRIGGER IF EXISTS trigger_update_customer_full_name ON customers;
CREATE TRIGGER trigger_update_customer_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_full_name();

-- Update existing records
UPDATE customers 
SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE full_name IS NULL OR full_name = '';

-- Make email nullable as well (since it's optional in the form)
ALTER TABLE customers 
  ALTER COLUMN email DROP NOT NULL;
