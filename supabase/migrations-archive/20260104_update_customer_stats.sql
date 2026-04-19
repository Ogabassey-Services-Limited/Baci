-- Function to calculate and update customer stats
CREATE OR REPLACE FUNCTION fn_update_customer_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_customer_id UUID;
BEGIN
    -- Determine the customer_id based on the operation
    IF (TG_OP = 'DELETE') THEN
        target_customer_id := OLD.customer_id;
    ELSE
        target_customer_id := NEW.customer_id;
    END IF;

    -- Update the specific customer's stats
    -- We consider an order "countable" towards spent if status is paid or completed
    -- total_orders counts all non-cancelled orders usually, or just all? Let's go with all non-cancelled for accuracy? 
    -- Actually, simple count is usually best for "history", filters can be applied on UI. 
    -- But total_spent definitely needs to be only paid items.
    
    -- Let's stick to simple aggregating.
    UPDATE customers
    SET 
        total_orders = (
            SELECT count(*) 
            FROM orders 
            WHERE customer_id = target_customer_id
        ),
        total_spent = COALESCE((
            SELECT sum(total) 
            FROM orders 
            WHERE customer_id = target_customer_id 
            AND payment_status = 'paid'
        ), 0),
        updated_at = NOW()
    WHERE id = target_customer_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow rerun
DROP TRIGGER IF EXISTS update_customer_stats_trigger ON orders;

-- Create Trigger
CREATE TRIGGER update_customer_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_update_customer_stats();

-- Backfill existing data
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM customers LOOP
        UPDATE customers
        SET 
            total_orders = (
                SELECT count(*) 
                FROM orders 
                WHERE customer_id = r.id
            ),
            total_spent = COALESCE((
                SELECT sum(total) 
                FROM orders 
                WHERE customer_id = r.id 
                AND payment_status = 'paid'
            ), 0)
        WHERE id = r.id;
    END LOOP;
END $$;
