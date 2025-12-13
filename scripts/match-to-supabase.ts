import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import Fuse from 'fuse.js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TimestampMatch {
    file: string;
    fileDate: string;
    productId: number;
    productName: string;
    diffSeconds: number;
}

interface SupabaseProduct {
    id: string;
    slug: string;
    name: string;
}

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function matchToSupabase() {
    console.log("🚀 Matching timestamp correlations to Supabase...");

    // 1. Load timestamp matches
    const matches: TimestampMatch[] = JSON.parse(
        fs.readFileSync('timestamp_matches.json', 'utf-8')
    );
    console.log(`📦 Loaded ${matches.length} timestamp matches`);

    // 2. Load Supabase products
    const { data: supaProducts, error } = await supabase
        .from('products')
        .select('id, slug, name')
        .not('slug', 'is', null);

    if (error || !supaProducts) {
        console.error("❌ Failed to fetch Supabase products:", error);
        process.exit(1);
    }
    console.log(`✅ Loaded ${supaProducts.length} Supabase products`);

    // 3. Fuzzy match setup
    const fuse = new Fuse(supaProducts, {
        keys: ['name', 'slug'],
        threshold: 0.5,
        includeScore: true
    });

    const finalMatches: any[] = [];
    const failedMatches: any[] = [];

    for (const match of matches) {
        const searchResult = fuse.search(match.productName);

        if (searchResult.length > 0 && searchResult[0].score! < 0.5) {
            const supaProduct = searchResult[0].item;
            console.log(`✅ "${match.productName}" -> "${supaProduct.name}" (score: ${searchResult[0].score?.toFixed(3)})`);

            finalMatches.push({
                oldFile: match.file.replace('*', ''),
                oldProductName: match.productName,
                supabaseId: supaProduct.id,
                supabaseName: supaProduct.name,
                supabaseSlug: supaProduct.slug,
                newFilename: `${supaProduct.slug}.webp`,
                score: searchResult[0].score
            });
        } else {
            console.log(`❌ No match for: "${match.productName}"`);
            failedMatches.push(match);
        }
    }

    console.log(`\n📊 Final Summary:`);
    console.log(`✅ Matched to Supabase: ${finalMatches.length}`);
    console.log(`❌ No Supabase match: ${failedMatches.length}`);

    // Save results
    fs.writeFileSync('final_migration.json', JSON.stringify(finalMatches, null, 2));
    fs.writeFileSync('failed_supabase_matches.json', JSON.stringify(failedMatches, null, 2));

    console.log('\n📄 Saved to final_migration.json and failed_supabase_matches.json');
}

matchToSupabase();
