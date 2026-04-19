-- Create RPC function to efficiently aggregate total sales
-- This avoids fetching all orders client-side for better performance
CREATE OR REPLACE FUNCTION get_total_sales()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(total), 0) FROM orders;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION get_total_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_sales() TO anon;
