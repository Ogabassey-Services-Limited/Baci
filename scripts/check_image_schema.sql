-- Check full schema of ProductImageData
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'ProductImageData';

-- Check sample data with all columns
SELECT * FROM "ProductImageData" LIMIT 3;
