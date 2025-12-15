
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SOURCE_DIRS = [
    '/Users/mac/Baci-app/Baci/public/website designs/iphones',
    '/Users/mac/Baci-app/Baci/public/website designs/SAMSUNG',
    '/Users/mac/Baci-app/Baci/public/website designs/LAPTOPS AND OTHERS' // for S21 FE etc
];

const CDN_BASE_URL = 'https://cdn.ogabassey.com/products';

interface ImageMapping {
    originalPath: string;
    filename: string;
    productNameRaw: string;
    colorRaw: string;
    matchedProductId?: string;
    matchedProductSlug?: string;
    newFilename?: string;
}

// Function to recursively find files
function findImages(dir: string, fileList: string[] = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            findImages(filePath, fileList);
        } else {
            if (/\.(avif|png|jpg|webp|jpeg)$/i.test(file)) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

// Heuristic to parse filename into Product + Color
// Best effort parser based on "Product Name Color.ext" format
function parseFilename(filePath: string): Partial<ImageMapping> {
    const filename = path.basename(filePath);
    const namePart = filename.replace(/\.(avif|png|jpg|webp)$/i, '');

    // Strategy: Split by common color names or " - " separators
    // Most files look like "SAMSUNG GALAXY S24 ULTRA TITANIUM YELLOW"
    // or "iPhone 13 Blue"

    // Common colors to serve as split point (files usually end with color)
    const colors = ['black', 'white', 'gold', 'silver', 'blue', 'green', 'red', 'purple', 'yellow', 'pink', 'gray', 'grey', 'titanium', 'cream', 'lavender', 'mint', 'violet', 'navy', 'olive', 'graphite', 'starlight', 'midnight'];

    let productRaw = namePart;
    let colorRaw = 'Generic'; // Default

    // Try to find the last occurrence of a known color
    const lowerName = namePart.toLowerCase();
    for (const color of colors) {
        if (lowerName.includes(color)) {
            // Split at the color
            const index = lowerName.lastIndexOf(color);
            // Heuristic: Color is usually at the end
            if (index > 5) { // Ensure there's a product name before it
                productRaw = namePart.substring(0, index).trim();
                colorRaw = namePart.substring(index).trim();
                // If colorRaw has "Product" or "Titanium" prefix, keep it
                break;
            }
        }
    }

    // Cleanup product name
    productRaw = productRaw
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/samsung galaxy/i, 'Samsung Galaxy') // Normalize brand
        .replace(/iphone/i, 'iPhone')
        .trim();

    return {
        originalPath: filePath,
        filename,
        productNameRaw: productRaw,
        colorRaw: colorRaw
    };
}

async function main() {
    console.log('🔍 Scanning source directories...');
    let allFiles: string[] = [];
    for (const dir of SOURCE_DIRS) {
        allFiles = allFiles.concat(findImages(dir));
    }
    console.log(`Found ${allFiles.length} images.`);

    const mappings: ImageMapping[] = [];
    for (const file of allFiles) {
        const parsed = parseFilename(file);
        if (parsed.productNameRaw && (parsed.productNameRaw.toLowerCase().includes('iphone') || parsed.productNameRaw.toLowerCase().includes('samsung'))) {
            mappings.push(parsed as ImageMapping);
        }
    }
    console.log(`Parsed ${mappings.length} relevant images.`);

    // Fetch all used products from DB (where we want to assign images)
    console.log('📦 Fetching products from DB...');
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug')
        .eq('is_parent', false) // Only target used/variants for now
        .or('name.ilike.%iPhone%,name.ilike.%Samsung%');

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    console.log(`Fetched ${products?.length} products.`);

    // Match logic
    const updates: any[] = [];

    for (const map of mappings) {
        if (!products) continue;

        // Simple fuzzy match: Does DB product name contain the image product name?
        // e.g. DB: "iPhone 13 128GB" contains Image: "iPhone 13"
        const matched = products.filter(p => p.name.toLowerCase().includes(map.productNameRaw.toLowerCase()));

        for (const product of matched) {
            // Generate new filename
            const cleanColor = map.colorRaw.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const cleanProduct = map.productNameRaw.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const newFilename = `${cleanProduct}-${cleanColor}.avif`;
            const cdnUrl = `${CDN_BASE_URL}/${newFilename}`;

            updates.push({
                productId: product.id,
                productName: product.name,
                imagePath: map.originalPath,
                newFilename: newFilename,
                color: map.colorRaw,
                cdnUrl: cdnUrl
            });
        }
    }

    console.log(`✅ Generated ${updates.length} potential updates.`);

    // Deduplicate files to upload (many products might map to same image)
    const uniqueUploads = new Map<string, string>(); // newFilename -> originalPath
    updates.forEach(u => uniqueUploads.set(u.newFilename, u.imagePath));

    console.log(`🚀 Unique images to upload: ${uniqueUploads.size}`);

    // Output commands to file for review
    const uploadCommands = Array.from(uniqueUploads.entries()).map(([dest, src]) => `scp "${src}" bassey@82.29.190.219:~/upload_temp/${dest}`).join('\n');
    const dbUpdates = updates.map(u => `UPDATE products SET images = jsonb_set(COALESCE(images, '[]'::jsonb), '{0}', '"${u.cdnUrl}"'), color_images = jsonb_set(COALESCE(color_images, '{}'::jsonb), '{${u.color}}', '["${u.cdnUrl}"]') WHERE id = '${u.productId}';`).join('\n');

    fs.writeFileSync('migration_upload.sh', uploadCommands);
    fs.writeFileSync('migration_db.sql', dbUpdates);

    console.log('📝 Created migration_upload.sh and migration_db.sql for review.');
}

main().catch(console.error);
