#!/usr/bin/env npx ts-node
/**
 * Product Color Image Sync Script
 * 
 * This script:
 * 1. Scans local image directories for product color images
 * 2. Uploads them to Supabase Storage (CDN)
 * 3. Updates the products.color_images JSONB mapping
 * 
 * Usage:
 *   npx ts-node scripts/sync-color-images.ts --brand "iPhone 16"
 *   npx ts-node scripts/sync-color-images.ts --all
 * 
 * Directory structure expected:
 *   public/website designs/iphones/iPhone 16/
 *     ├── iphone 16 Black.avif
 *     ├── iphone 16 Pink.avif
 *     └── iphone 16 Pro Max Desert Titanium.avif
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CDN_BASE_URL = 'https://cdn.ogabassey.com/products';
const LOCAL_IMAGES_DIR = path.join(process.cwd(), 'public/website designs');

// Product family to directory mapping
const PRODUCT_DIRECTORIES: Record<string, string> = {
    'iPhone 16': 'iphones/iPhone 16',
    'iPhone 15': 'iphones/iphone 15',
    'iPhone 14': 'iphones/iphone 14',
    'iPhone 13': 'iphones/iphone 13',
    'Samsung': 'SAMSUNG',
    'Google Pixel': 'google',
    'Tecno': 'TECNO',
    'Infinix': 'infinix',
    'MacBook': 'Macbooks',
    'iPad': 'IPADS',
};

interface ColorImageMapping {
    [colorName: string]: string[];
}

interface ProductFamily {
    id: string;
    name: string;
    color_images: ColorImageMapping;
    images: string[];
}

/**
 * Parse color from filename
 * Example: "iphone 16 Pro Max Desert Titanium.avif" -> { product: "iPhone 16 Pro Max", color: "Desert Titanium" }
 */
function parseFilename(filename: string): { product: string; color: string } | null {
    // Remove extension
    const baseName = filename.replace(/\.(avif|png|jpg|jpeg|webp)$/i, '');

    // Known color patterns (order matters - longer matches first)
    const colorPatterns = [
        'Black Titanium', 'White Titanium', 'Natural Titanium', 'Desert Titanium',
        'Midnight Black', 'Starlight White', 'Space Gray', 'Rose Gold',
        'Phantom Black', 'Phantom Green', 'Phantom Silver',
        'Ultramarine', 'Teal', 'Pink', 'Black', 'White', 'Blue', 'Green', 'Red',
        'Silver', 'Gold', 'Graphite', 'Midnight', 'Starlight', 'Purple',
        'Coral', 'Yellow', 'Lavender', 'Mint', 'Cream',
    ];

    for (const color of colorPatterns) {
        if (baseName.toLowerCase().includes(color.toLowerCase())) {
            const product = baseName.replace(new RegExp(color, 'i'), '').trim();
            return { product: product.replace(/\s+/g, ' ').trim(), color };
        }
    }

    return null;
}

/**
 * Generate CDN-friendly filename
 */
function generateCdnFilename(product: string, color: string, extension: string): string {
    const slug = `${product}-${color}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return `${slug}.${extension}`;
}

/**
 * Upload file to Supabase Storage
 */
async function uploadToStorage(localPath: string, remotePath: string): Promise<string | null> {
    try {
        const fileBuffer = fs.readFileSync(localPath);
        const contentType = localPath.endsWith('.avif') ? 'image/avif' :
            localPath.endsWith('.webp') ? 'image/webp' :
                localPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

        const { data, error } = await supabase.storage
            .from('products')
            .upload(remotePath, fileBuffer, {
                contentType,
                upsert: true
            });

        if (error) {
            console.error(`  ❌ Upload failed: ${error.message}`);
            return null;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('products')
            .getPublicUrl(remotePath);

        return urlData.publicUrl;
    } catch (err) {
        console.error(`  ❌ Upload error:`, err);
        return null;
    }
}

/**
 * Scan directory for color images and match to products
 */
async function scanAndUploadImages(productFamily: string): Promise<Map<string, ColorImageMapping>> {
    const dirKey = Object.keys(PRODUCT_DIRECTORIES).find(k =>
        productFamily.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(productFamily.toLowerCase())
    );

    if (!dirKey) {
        console.error(`❌ No directory mapping found for: ${productFamily}`);
        return new Map();
    }

    const localDir = path.join(LOCAL_IMAGES_DIR, PRODUCT_DIRECTORIES[dirKey]);

    if (!fs.existsSync(localDir)) {
        console.error(`❌ Directory not found: ${localDir}`);
        return new Map();
    }

    console.log(`\n📁 Scanning: ${localDir}`);

    const productMappings = new Map<string, ColorImageMapping>();
    const files = fs.readdirSync(localDir).filter(f =>
        /\.(avif|png|jpg|jpeg|webp)$/i.test(f)
    );

    for (const file of files) {
        const parsed = parseFilename(file);
        if (!parsed) {
            console.log(`  ⚠️ Could not parse: ${file}`);
            continue;
        }

        const { product, color } = parsed;
        console.log(`  📷 Found: ${product} - ${color}`);

        // Determine which parent product this belongs to
        let parentName = productFamily;
        if (product.toLowerCase().includes('pro max')) {
            parentName = productFamily.replace(' Pro Max', '').replace(' Pro', '') + ' Pro Max';
        } else if (product.toLowerCase().includes('pro') && !product.toLowerCase().includes('pro max')) {
            parentName = productFamily.replace(' Pro Max', '').replace(' Pro', '') + ' Pro';
        } else if (product.toLowerCase().includes('plus')) {
            parentName = productFamily.replace(' Plus', '') + ' Plus';
        }

        // Upload to CDN
        const extension = path.extname(file).substring(1);
        const cdnFilename = generateCdnFilename(product, color, extension);
        const localPath = path.join(localDir, file);

        console.log(`  ⬆️ Uploading: ${cdnFilename}`);
        const cdnUrl = await uploadToStorage(localPath, cdnFilename);

        if (cdnUrl) {
            if (!productMappings.has(parentName)) {
                productMappings.set(parentName, {});
            }
            const mapping = productMappings.get(parentName)!;
            if (!mapping[color]) {
                mapping[color] = [];
            }
            mapping[color].push(cdnUrl);
            console.log(`  ✅ Uploaded: ${cdnUrl}`);
        }
    }

    return productMappings;
}

/**
 * Update database with color_images mapping
 */
async function updateDatabase(productMappings: Map<string, ColorImageMapping>): Promise<void> {
    for (const [productName, colorImages] of productMappings) {
        console.log(`\n💾 Updating database: ${productName}`);

        // Find parent product
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('id, name, color_images, images')
            .eq('is_parent', true)
            .ilike('name', productName)
            .single();

        if (fetchError || !product) {
            console.error(`  ❌ Product not found: ${productName}`);
            continue;
        }

        // Merge with existing color_images
        const existingColorImages = (product.color_images || {}) as ColorImageMapping;
        const mergedColorImages = { ...existingColorImages };

        for (const [color, urls] of Object.entries(colorImages)) {
            if (!mergedColorImages[color]) {
                mergedColorImages[color] = [];
            }
            // Add new URLs, avoiding duplicates
            for (const url of urls) {
                if (!mergedColorImages[color].includes(url)) {
                    mergedColorImages[color].push(url);
                }
            }
        }

        // Also update images array with all unique URLs
        const existingImages = (product.images || []) as string[];
        const allUrls = Object.values(mergedColorImages).flat();
        const mergedImages = [...new Set([...existingImages, ...allUrls])];

        // Update database
        const { error: updateError } = await supabase
            .from('products')
            .update({
                color_images: mergedColorImages,
                images: mergedImages
            })
            .eq('id', product.id);

        if (updateError) {
            console.error(`  ❌ Update failed: ${updateError.message}`);
        } else {
            console.log(`  ✅ Updated: ${Object.keys(mergedColorImages).length} colors, ${mergedImages.length} total images`);
        }
    }
}

/**
 * Generate report of missing color images
 */
async function generateReport(productFamily: string): Promise<void> {
    console.log('\n📊 Generating Missing Images Report\n');

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, color_images, images')
        .eq('is_parent', true)
        .ilike('name', `%${productFamily}%`);

    if (error || !products) {
        console.error('Failed to fetch products');
        return;
    }

    // Known colors per product family
    const familyColors: Record<string, string[]> = {
        'iPhone 16': ['Black', 'White', 'Pink', 'Teal', 'Ultramarine'],
        'iPhone 16 Plus': ['Black', 'White', 'Pink', 'Teal', 'Ultramarine'],
        'iPhone 16 Pro': ['Black Titanium', 'White Titanium', 'Natural Titanium', 'Desert Titanium'],
        'iPhone 16 Pro Max': ['Black Titanium', 'White Titanium', 'Natural Titanium', 'Desert Titanium'],
    };

    for (const product of products) {
        const expectedColors = familyColors[product.name] || [];
        const colorImages = (product.color_images || {}) as ColorImageMapping;

        console.log(`\n${product.name}:`);

        for (const color of expectedColors) {
            const hasImage = colorImages[color] && colorImages[color].length > 0;
            console.log(`  ${hasImage ? '✅' : '❌'} ${color}${hasImage ? '' : ' - MISSING'}`);
        }
    }
}

// Main execution
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const brandIndex = args.indexOf('--brand');
    const reportIndex = args.indexOf('--report');
    const isAll = args.includes('--all');

    if (reportIndex !== -1) {
        const brand = args[reportIndex + 1] || 'iPhone';
        await generateReport(brand);
        return;
    }

    if (brandIndex !== -1 && args[brandIndex + 1]) {
        const brand = args[brandIndex + 1];
        console.log(`🚀 Syncing color images for: ${brand}`);

        const mappings = await scanAndUploadImages(brand);
        await updateDatabase(mappings);
        await generateReport(brand);

    } else if (isAll) {
        console.log('🚀 Syncing all product families');

        for (const family of Object.keys(PRODUCT_DIRECTORIES)) {
            const mappings = await scanAndUploadImages(family);
            await updateDatabase(mappings);
        }

    } else {
        console.log(`
Usage:
  npx ts-node scripts/sync-color-images.ts --brand "iPhone 16"
  npx ts-node scripts/sync-color-images.ts --report "iPhone"
  npx ts-node scripts/sync-color-images.ts --all

Options:
  --brand <name>   Sync a specific product family
  --report <name>  Generate missing images report only
  --all            Sync all known product families
    `);
    }
}

main().catch(console.error);
