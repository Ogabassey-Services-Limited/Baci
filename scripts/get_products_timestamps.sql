SELECT id, "productName", extract(epoch from "createdAt") * 1000 as created_ms, "isAvailable", "hasImages"
FROM "Products" 
WHERE "hasImages" = true
ORDER BY "createdAt" DESC;
