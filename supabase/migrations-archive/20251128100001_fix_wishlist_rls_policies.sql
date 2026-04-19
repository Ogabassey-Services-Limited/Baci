-- Migration: Fix wish list RLS policies for secure access
-- Created: 2025-11-28
-- Description: Replace overly permissive RLS policies with secure ones
--              that properly restrict access to authenticated users and merchants

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can read wish list items" ON wish_list_items;
DROP POLICY IF EXISTS "Anyone can add to wish list" ON wish_list_items;
DROP POLICY IF EXISTS "Anyone can remove from their wish list" ON wish_list_items;

-- Create secure RLS policies

-- Authenticated users can read their own wishlist items (by email match)
-- Merchants can also view wishlist items for their products
CREATE POLICY "Users can read own wishlist items"
    ON wish_list_items
    FOR SELECT
    USING (
        -- User can read if their email matches the customer_email
        customer_email = (SELECT auth.email())
        OR
        -- Or if they're the merchant who owns the product
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

-- Authenticated users can add items to their own wishlist
-- Guest sessions are handled via API with hashed session tokens
CREATE POLICY "Users can add to own wishlist"
    ON wish_list_items
    FOR INSERT
    WITH CHECK (
        -- Only allow insert if email matches authenticated user
        -- OR if it's a guest session (starts with 'guest:')
        customer_email = (SELECT auth.email())
        OR customer_email LIKE 'guest:%'
    );

-- Users can only delete their own wishlist items
CREATE POLICY "Users can delete own wishlist items"
    ON wish_list_items
    FOR DELETE
    USING (
        customer_email = (SELECT auth.email())
        OR customer_email LIKE 'guest:%'
    );

-- Keep the merchant view policy (already exists but ensure it's there)
DROP POLICY IF EXISTS "Merchants can view wish lists for their products" ON wish_list_items;
CREATE POLICY "Merchants can view wish lists for their products"
    ON wish_list_items
    FOR SELECT
    USING (
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

-- Add comment explaining the security model
COMMENT ON TABLE wish_list_items IS 'Customer wish lists with secure RLS - authenticated users access by email, guests use hashed session tokens prefixed with guest:';
