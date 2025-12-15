import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import Fuse from 'fuse.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface OldImage {
    productName: string;
    old_id: number;
    color: string;
    imageDataUrl: string;
    isAvailable: boolean;
}

interface NewProduct {
    id: string;
    slug: string;
    name: string;
    category?: string;
}

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const VPS_PATH = process.env.VPS_PATH || '/var/www/cdn/products';
const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://cdn.ogabassey.com/products';

async function migrateImages() {
    console.log("🚀 Starting Image Migration Script...");

    // 1. Load Old Images
    const oldImagesPath = path.join(process.cwd(), 'scripts', 'old_images.json');
    if (!fs.existsSync(oldImagesPath)) {
        console.error("❌ old_images.json not found!");
        process.exit(1);
    }
    const oldImages: OldImage[] = JSON.parse(fs.readFileSync(oldImagesPath, 'utf-8'));
    console.log(`📦 Loaded ${oldImages.length} old image records`);

    // 2. Load New Products from Supabase
    console.log("🔄 Fetching Baci products...");
    // Limit to active products (or all if needed)
    // We need ID, Slug, Name. 
    // We filter by merchant_id ideally, but fuzzy matching name is safer globally first.
    const { data: newProducts, error } = await supabase
        .from('products')
        .select('id, slug, name, category')
        .not('slug', 'is', null);

    if (error || !newProducts) {
        console.error("❌ Failed to fetch products:", error);
        process.exit(1);
    }
    console.log(`✅ Loaded ${newProducts.length} Supabase products`);

    // Hardcoded Map for the 7 Rescue Images
    const HARDCODED_MAP: Record<string, string> = {
        "Dell XPS 15 9560 15.6” 4K Touchscreen ": "Dell XPS 15 9560 (Premium Used)",
        "DELL G3 15 3579 Gaming Laptop 15.6” FHD": "Dell G3 15 3579 Gaming Laptop", // Likely missing
        "Dell Precision 5540 15.6” FHD Non-Touch": "Dell Precision 5540" // Likely missing
    };

    // 3. Fuzzy Match
    const fuse = new Fuse(newProducts, {
        keys: ['name', 'slug'],
        threshold: 0.4, // 0.0 is perfect match, 0.6 is very loose
        includeScore: true
    });

    const matches: any[] = [];
    const unmatched: any[] = [];
    const commands: string[] = [];
    const updatePayloads: Record<string, any> = {};

    // Group old images by productName to avoid re-matching same product multiple times
    // But each COLOR needs individual processing.

    for (const item of oldImages) {
        // Extract filename from URL
        // URL: https://api.ogabassey.com/products/productImages-1755111273881-WSV0UI.avif
        const filename = item.imageDataUrl.split('/').pop();
        if (!filename) continue;

        const searchResult = fuse.search(item.productName);

        let match: NewProduct | undefined;

        // Strategy 0: Hardcoded Map
        if (HARDCODED_MAP[item.productName]) {
            const targetName = HARDCODED_MAP[item.productName];
            match = newProducts.find(p => p.name === targetName);
            if (match) {
                console.log(`✅ Hardcoded Match: "${item.productName}" -> "${match.name}"`);
            } else {
                console.log(`❌ Hardcoded Name Not Found in DB: "${targetName}"`);
            }
        }

        // Log best match for debugging
        if (searchResult.length > 0) {
            console.log(`🔍 Inspecting "${item.productName}"... Best Fuse Match: "${searchResult[0].item.name}" (Score: ${searchResult[0].score})`);
        }

        // Strategy 1: Fuse.js
        if (!match && searchResult.length > 0 && searchResult[0].score! < 0.6) { // Relaxed to 0.6
            match = searchResult[0].item;
            console.log(`✅ Fuzzy Match: "${item.productName}" -> "${match.name}" (Score: ${searchResult[0].score})`);
        }

        // Strategy 2: Token Overlap (if fuzzy failed)
        if (!match) {
            // Simple token overlap
            const oldTokens = new Set(item.productName.toLowerCase().split(/[^a-z0-9]+/));
            let bestOverlapScore = 0;
            let bestTokenMatch: NewProduct | undefined;

            for (const p of newProducts) {
                const newTokens = p.name.toLowerCase().split(/[^a-z0-9]+/);
                let intersection = 0;
                newTokens.forEach((t: string) => { if (oldTokens.has(t) && t.length > 2) intersection++; });

                const score = intersection / newTokens.length;
                if (score > bestOverlapScore) {
                    bestOverlapScore = score;
                    bestTokenMatch = p;
                }
            }

            if (bestOverlapScore > 0.5) {
                match = bestTokenMatch;
                console.log(`✅ Token Match: "${item.productName}" -> "${match!.name}" (Score: ${bestOverlapScore})`);
            } else if (bestTokenMatch) {
                console.log(`❌ Token Failed: "${item.productName}" -> "${bestTokenMatch.name}" (Score: ${bestOverlapScore})`);
            }
        }

        if (match) {
            matches.push({
                old: item.productName,
                new: match.name,
                color: item.color,
                filename
            });

            // Generate New Filename
            const colorSlug = slugify(item.color);
            const ext = path.extname(filename);
            const newFilename = `${match.slug}-${colorSlug}${ext}`;

            // Add command to script
            commands.push(`[ -f "${VPS_PATH}/${filename}" ] && mv "${VPS_PATH}/${filename}" "${VPS_PATH}/${newFilename}"`);

            // Prepare Supabase Payload
            if (!updatePayloads[match.id]) {
                updatePayloads[match.id] = {
                    id: match.id,
                    name: match.name,
                    images: [],
                };
            }

            const cdnUrl = `${CDN_BASE_URL}/${newFilename}`;

            // Add to array
            updatePayloads[match.id].images.push({
                url: cdnUrl,
                alt: `${match.name} - ${item.color}`,
                color: item.color,
                isPrimary: item.color.toLowerCase().includes('black') || updatePayloads[match.id].images.length === 0,
                width: 800,
                height: 800
            });

        } else {
            console.log(`⚠️ Unmatched: "${item.productName}"`);
            unmatched.push(item);
        }
    }

    console.log(`🎯 Matched: ${matches.length}`);
    console.log(`⚠️ Unmatched: ${unmatched.length}`);

    // 4. Generate VPS Script
    const vpsScript = `#!/bin/bash
# Image Renaming Script
# Generated by migrate-images-vps.ts

mkdir -p ${VPS_PATH}/migrated

${commands.join('\n')}

echo "✅ Renamed ${commands.length} files"
`;

    fs.writeFileSync(path.join(process.cwd(), 'vps-migration.sh'), vpsScript);
    console.log("📄 Generated vps-migration.sh");

    // 5. Generate Supabase SQL Update List
    // We can't do one big SQL query easily for JSON arrays constructed dynamically.
    // Better to generate a JSON file we can iterate and update via API or script.
    fs.writeFileSync(path.join(process.cwd(), 'supabase-updates.json'), JSON.stringify(Object.values(updatePayloads), null, 2));
    console.log("📄 Generated supabase-updates.json");

    // Log unmatched validation
    fs.writeFileSync(path.join(process.cwd(), 'unmatched_images.json'), JSON.stringify(unmatched, null, 2));
}

migrateImages().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
