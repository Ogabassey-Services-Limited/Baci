-- Baci E-Commerce Platform Database Schema
-- Copy and paste this into Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- MERCHANTS TABLE (Store Builders/Owners)
-- =============================================
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  business_type TEXT,
  country TEXT,
  logo_url TEXT,
  brand_colors JSONB, -- {primary, secondary, accent}
  pages JSONB, -- {about, contact, privacy, terms, returns, shipping}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Index for faster lookups
CREATE INDEX idx_merchants_user_id ON merchants(user_id);
CREATE INDEX idx_merchants_email ON merchants(email);

-- =============================================
-- CUSTOMERS TABLE (Shoppers)
-- =============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(merchant_id, email) -- Each customer email is unique per merchant
);

-- Indexes
CREATE INDEX idx_customers_merchant_id ON customers(merchant_id);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_email ON customers(email);

-- =============================================
-- PRODUCTS TABLE
-- =============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_small TEXT,
  image_large TEXT,
  image_hint TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_products_is_active ON products(is_active);

-- =============================================
-- ORDERS TABLE
-- =============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, shipped, delivered, cancelled
  items JSONB NOT NULL, -- Array of {product_id, name, price, quantity}
  subtotal DECIMAL(10, 2) NOT NULL,
  shipping_address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ========== MERCHANTS POLICIES ==========

-- Merchants can read their own data
CREATE POLICY "Merchants can view own data"
  ON merchants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Merchants can update their own data
CREATE POLICY "Merchants can update own data"
  ON merchants
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Merchants can insert their own data
CREATE POLICY "Merchants can insert own data"
  ON merchants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);



-- ========== CUSTOMERS POLICIES ==========

-- Customers can read their own data
CREATE POLICY "Customers can view own data"
  ON customers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Customers can update their own data
CREATE POLICY "Customers can update own data"
  ON customers
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Merchants can view their own customers
CREATE POLICY "Merchants can view own customers"
  ON customers
  FOR SELECT
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Allow customer creation (for registration)
CREATE POLICY "Allow customer registration"
  ON customers
  FOR INSERT
  WITH CHECK (true);

-- ========== PRODUCTS POLICIES ==========

-- Anyone can view active products (for shopping)
CREATE POLICY "Public can view active products"
  ON products
  FOR SELECT
  USING (is_active = true);

-- Merchants can manage their own products
CREATE POLICY "Merchants can manage own products"
  ON products
  FOR ALL
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- ========== ORDERS POLICIES ==========

-- Customers can view their own orders
CREATE POLICY "Customers can view own orders"
  ON orders
  FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM customers WHERE id = customer_id));

-- Merchants can view their own orders
CREATE POLICY "Merchants can view own orders"
  ON orders
  FOR SELECT
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Merchants can update their own orders (status changes)
CREATE POLICY "Merchants can update own orders"
  ON orders
  FOR UPDATE
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Allow order creation for customers and merchants
CREATE POLICY "Allow order creation"
  ON orders
  FOR INSERT
  WITH CHECK (
    (
      -- Is the user the customer of this order?
      auth.uid() = (SELECT user_id FROM customers WHERE id = customer_id)
    ) OR (
      -- Is the user the merchant of this order's customer?
      merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    )
  );

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================

-- Note: You'll need to create auth users first through Supabase Auth
-- Then link them here with their user_id

-- Sample merchant (replace USER_ID_HERE with actual auth.users id)
-- INSERT INTO merchants (user_id, email, business_name, business_type, country, logo_url, brand_colors, pages) VALUES
-- ('USER_ID_HERE', 'demo@example.com', 'Demo Store', 'fashion', 'US', 'https://example.com/logo.png',
--  '{"primary": "#3F51B5", "secondary": "#9C27B0", "accent": "#FFC107"}'::jsonb,
--  '{"about": "About us...", "contact": "Contact info..."}'::jsonb
-- );
