-- Fix Critical Performance Issues Part 3: Complete Policy Consolidation
-- This removes the remaining redundant policies that are now covered by consolidated policies

-- customers table: Remove the old merchant-specific policies (now covered by consolidated policies)
DROP POLICY IF EXISTS "Merchants can view their own customers" ON customers;
DROP POLICY IF EXISTS "Merchants can insert their own customers" ON customers;
DROP POLICY IF EXISTS "Merchants can update their own customers" ON customers;

-- order_items table: Remove the old customer and merchant-specific policies (now covered by consolidated policies)
DROP POLICY IF EXISTS "Customers can view own order items" ON order_items;
DROP POLICY IF EXISTS "Merchants can view own order items" ON order_items;

-- page_configs table: Remove the old merchant-specific policy (now covered by consolidated policy)
DROP POLICY IF EXISTS "Merchants can view their own page configs" ON page_configs;
