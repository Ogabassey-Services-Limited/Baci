-- Fix iPhone 17 Pricing (Convert input Cost to Selling Price with 15% Margin)

DO $$
BEGIN
    -- Update iPhone 17 products where cost_price is missing (implying 'price' currently holds the cost)
    UPDATE products
    SET
        cost_price = price,
        -- Apply 15% margin: Price = Cost / 0.85
        -- Round to nearest 100 for clean pricing
        price = ROUND((price / 0.85) / 100) * 100
    WHERE name ILIKE 'iPhone 17%'
    AND cost_price IS NULL;
END $$;
