
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// List of games to consolidate and their platform patterns
const GAMES_TO_CONSOLIDATE = [
    { groupStart: 'Just Dance', regex: /^Just Dance.*(2021|2022|2023|2024|2025)/i },
    { groupStart: 'NBA', regex: /^NBA.*(24|25|26)/i },
    { groupStart: 'FIFA', regex: /^FIFA/i }, // General FIFA catch
    { groupStart: 'FC 24', regex: /^FC 24/i },
    { groupStart: 'Lego', regex: /^Lego/i },
    { groupStart: 'Sonic', regex: /^Sonic/i },
    { groupStart: 'Naruto', regex: /^Naruto/i },
    { groupStart: 'Mortal Kombat', regex: /^Mortal Kombat/i },
    { groupStart: 'Grand Theft Auto', regex: /^Grand Theft Auto|GTA/i },
    { groupStart: 'Call of Duty', regex: /^Call of Duty|COD/i },
];

const PLATFORMS = [
    { name: 'PlayStation 5', keywords: ['ps5', 'playstation 5'] },
    { name: 'PlayStation 4', keywords: ['ps4', 'playstation 4'] },
    { name: 'Nintendo Switch', keywords: ['simtch', 'switch', 'nintendo'] },
    { name: 'Xbox Series X', keywords: ['xbox series x', 'series x'] },
    { name: 'Xbox Series S', keywords: ['xbox series s', 'series s'] },
    { name: 'Xbox One', keywords: ['xbox one'] },
];

function detectPlatform(product: { name: string, category?: string, slug?: string }): string | null {
    const text = `${product.name} ${product.category || ''} ${product.slug || ''}`.toLowerCase();
    for (const p of PLATFORMS) {
        if (p.keywords.some(k => text.includes(k))) {
            return p.name;
        }
    }
    return null;
}

// Helper: Normalize name to remove platform (for Base Product Name)
function cleanGameName(name: string): string {
    let cleaned = name;
    PLATFORMS.forEach(p => {
        p.keywords.forEach(k => {
            const regex = new RegExp(`\\b${k}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });
    });
    // Clean up extra parens and spaces
    return cleaned
        .replace(/\(\)/g, '')
        .replace(/\[\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function consolidateGames(dryRun = true) {
    console.log(`🎮 Starting Game Consolidation... (Dry Run: ${dryRun})`);

    // 1. Fetch all products provided we need to scan everyone to find matches
    // Optimization: Filter by category 'Games' or similar if possible. 
    // But schemas vary. Let's just fetch active products and name filter in JS.
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active'); // Only consolidate active ones for now

    if (error) throw error;

    console.log(`Fetched ${products.length} active products.`);

    const processedIds = new Set<string>();
    let totalConsolidated = 0;

    for (const gameGroup of GAMES_TO_CONSOLIDATE) {
        // specific filter logic per game group
        // Find all products matching this regex
        const matches = products.filter(p => !processedIds.has(p.id) && gameGroup.regex.test(p.name));

        // DEBUG: Log matches
        if (matches.length > 0) {
            console.log(`\nFound ${matches.length} matches for ${gameGroup.groupStart}`);
            matches.forEach(m => console.log(`  - Name: "${m.name}" | Cat: "${m.category}" | Slug: "${m.slug}"`));
        }

        // Group matches by "Clean Name" (e.g. "NBA 2K24 PS5" and "NBA 2K24 Switch" both -> "NBA 2K24")
        const groupedByCleanName: Record<string, typeof products> = {};

        matches.forEach(p => {
            const clean = cleanGameName(p.name);
            // DEBUG
            // console.log(`  Cleaned: "${p.name}" -> "${clean}"`);
            if (!groupedByCleanName[clean]) groupedByCleanName[clean] = [];
            groupedByCleanName[clean].push(p);
        });

        for (const [cleanName, group] of Object.entries(groupedByCleanName)) {
            if (group.length < 2) continue; // No duplicates to consolidate

            // Filter groups that ACTUALLY have different platforms
            const platformsFound = new Set(group.map(p => detectPlatform(p)).filter(Boolean));

            // DEBUG
            console.log(`Checking group "${cleanName}": Found platforms:`, Array.from(platformsFound));

            if (platformsFound.size < 2) {
                // Skip if they are just "NBA 2k24" and "NBA 2k24" (Exact duplicate, handled elsewhere)
                // or if they are "NBA 2k24 PS5" and "NBA 2k24 PS5" (Duplicate PS5 listings)
                // We solely want Cross-Platform consolidation here.
                // console.log(`Skipping ${cleanName}: Not enough distinct platforms found.`);
                continue;
            }

            console.log(`\n📦 Processing Group: ${cleanName} (${group.length} variants)`);
            group.forEach(p => console.log(`   - [${detectPlatform(p) || 'Unknown'}] ${p.name} ($${p.price})`));

            if (!dryRun) {
                // 1. Pick Base (Lowest Price or First)
                const baseProduct = group[0];

                // Merge images from all products in group
                const allImages = new Set<string>();
                group.forEach(p => {
                    if (p.images && Array.isArray(p.images)) {
                        p.images.forEach((img: string) => allImages.add(img));
                    } else if (p.image) {
                        allImages.add(p.image);
                    }
                });
                const mergedImages = Array.from(allImages);

                const variants = group.map(p => ({
                    product_id: baseProduct.id,
                    merchant_id: baseProduct.merchant_id,
                    price_override: p.price,
                    stock_quantity: p.stock_quantity || 0,
                    sku: p.sku || `${baseProduct.sku}-VAR-${Math.random().toString(36).substr(2, 5)}`,
                    attributes: {
                        platform: detectPlatform(p) || 'Standard'
                    },
                    images: p.images, // Keep variant specific images
                }));

                // Update Base Product
                await supabase
                    .from('products')
                    .update({
                        name: cleanName,
                        has_variants: true,
                        images: mergedImages, // Update with merged images
                        // Ensure slug is clean too? For now keep original slug to avoid 404s or update it?
                        // Ideally update slug to clean-name-slug
                    })
                    .eq('id', baseProduct.id);

                console.log(`   ✅ Updated Base: ${baseProduct.name} -> ${cleanName}`);

                // Insert Variants
                const { error: varError } = await supabase
                    .from('product_variants')
                    .insert(variants);

                if (varError) console.error('   ❌ Error inserting variants:', varError);
                else console.log(`   ✅ Inserted ${variants.length} platform variants.`);

                // Archive others (NOT Base)
                const toArchive = group.slice(1);
                for (const p of toArchive) {
                    await supabase.from('products').update({ status: 'archived' }).eq('id', p.id);
                }
                console.log(`   🗑️ Archived ${toArchive.length} duplicate listings.`);
            }

            group.forEach(p => processedIds.add(p.id));
            totalConsolidated++;
        }
    }

    console.log(`\n🎉 Consolidation Complete. Processed ${totalConsolidated} groups.`);
}

const args = process.argv.slice(2);
const isLive = args.includes('--live');

consolidateGames(!isLive);
