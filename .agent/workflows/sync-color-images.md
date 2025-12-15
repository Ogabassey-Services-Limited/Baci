---
description: Sync product color images from local directory to CDN and update database mapping
---

# Product Color Image Sync Workflow

This workflow uploads product color images from the local `/public/website designs/` directory to the CDN and updates the `color_images` JSONB mapping in the database.

## Prerequisites

1. Images must be organized in subdirectories by product family:
   ```
   public/website designs/
   ├── iphones/
   │   ├── iPhone 16/
   │   │   ├── iphone 16 Black.avif
   │   │   ├── iphone 16 Pink.avif
   │   │   └── iphone 16 Pro Max Desert Titanium.avif
   │   └── iphone 15/
   ├── SAMSUNG/
   ├── TECNO/
   └── Macbooks/
   ```

2. Filename format: `{product name} {Color Name}.avif`
   - Examples: `iphone 16 Ultramarine.avif`, `Samsung Galaxy S24 Phantom Black.avif`

3. Parent products must exist in the database with `is_parent = TRUE`

## Steps

### 1. Check Missing Images (Optional)

Generate a report of which colors are missing images:

```bash
npx ts-node scripts/sync-color-images.ts --report "iPhone 16"
```

### 2. Sync Specific Product Family

Upload and map images for a specific product family:

```bash
npx ts-node scripts/sync-color-images.ts --brand "iPhone 16"
```

Common families:
- `"iPhone 16"` - All iPhone 16 variants
- `"Samsung"` - All Samsung products
- `"MacBook"` - All MacBook products
- `"iPad"` - All iPad products

### 3. Sync All Product Families

Upload and map images for ALL known product families:

```bash
npx ts-node scripts/sync-color-images.ts --all
```

## What the Script Does

1. **Scans** the local directory for image files (`.avif`, `.png`, `.jpg`, `.webp`)
2. **Parses** filenames to extract product name and color
3. **Uploads** each image to Supabase Storage (`products` bucket)
4. **Updates** the `products.color_images` JSONB column:
   ```json
   {
     "Black": ["https://cdn.ogabassey.com/products/iphone-16-black.avif"],
     "Pink": ["https://cdn.ogabassey.com/products/iphone-16-pink.avif"]
   }
   ```
5. **Updates** the `products.images` array with all unique URLs

## Image Optimization (2025 Best Practice)

**IMPORTANT:** Before uploading to CDN, convert images to AVIF format for optimal compression.

### On the CDN Server (after upload)

```bash
# SSH into the CDN server
ssh bassey@82.29.190.219

# Install AVIF tools if needed
sudo apt-get install -y libavif-bin

# Convert PNG to AVIF with quality 60 (good balance)
cd /var/www/cdn/products
for f in *.png; do
  avifenc "$f" "${f%.png}.avif" --min 20 --max 30
  rm "$f"
  echo "Converted: $f"
done

# Fix permissions
sudo chown www-data:www-data *.avif
sudo chmod 644 *.avif
```

### Compression Results

| Format | Size | Savings |
|--------|------|---------|
| PNG | 200KB | - |
| WebP | 40KB | 80% |
| AVIF | 5KB | **97%** |

## Adding New Product Families

Edit `scripts/sync-color-images.ts` and add to `PRODUCT_DIRECTORIES`:

```typescript
const PRODUCT_DIRECTORIES: Record<string, string> = {
  'iPhone 16': 'iphones/iPhone 16',
  'Samsung': 'SAMSUNG',
  'Your New Family': 'path/to/directory',
};
```

## Verification

After running the sync, verify in the database:

```sql
SELECT name, jsonb_pretty(color_images) as colors
FROM products 
WHERE is_parent = TRUE AND name LIKE 'iPhone%';
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Directory not found" | Check `PRODUCT_DIRECTORIES` mapping in script |
| "Could not parse" | Filename doesn't match expected format |
| "Product not found" | Parent product doesn't exist or `is_parent` is false |
| "Upload failed" | Check Supabase Storage permissions |
