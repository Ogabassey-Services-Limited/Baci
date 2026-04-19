-- Allow customers to view insurance policies for their own orders
-- This enables the mobile storefront to display policy details

CREATE POLICY "Customers can view insurance policies for their orders"
ON order_insurance_policies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_insurance_policies.order_id
    AND orders.customer_id = auth.uid()
  )
);
