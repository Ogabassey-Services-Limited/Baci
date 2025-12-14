SELECT 
    p.id as product_id,
    p."productName",
    c.name as category,
    pid.color,
    pid."imageDataUrl",
    p."isAvailable",
    p."hasImages"
FROM "Products" p
LEFT JOIN "ProductImageData" pid ON p.id = pid.product_id
LEFT JOIN "Categories" c ON p.category = c.id
WHERE p.is_deleted = false
ORDER BY p.id DESC;
