SELECT p."productName", pid.color, pid."imageDataUrl"
FROM "ProductImageData" pid
JOIN "Products" p ON pid.product_id = p.id;
