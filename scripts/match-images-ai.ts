import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ Missing API KEY');
    process.exit(1);
}

const google = createGoogleGenerativeAI({ apiKey });
const model = google('gemini-2.0-flash');

const PRIMARY_IMAGE_DIR = '/Users/mac/Baci-app/Baci/public/website designs';


function findImages(dir: string): string[] {
    const images: string[] = [];
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                images.push(...findImages(fullPath));
            } else if (/\.(avif|webp)$/i.test(item.name)) {
                images.push(path.relative(PRIMARY_IMAGE_DIR, fullPath));
            }
        }
    } catch (e) {
        console.warn(`Could not read dir ${dir}: ${e}`);
    }
    return images;
}

const START = parseInt(process.argv[2] || '0');
const END = parseInt(process.argv[3] || '2000');
const PART_ID = process.argv[4] || '1';
const OUTPUT_FILE = `scripts/ai_matches_part${PART_ID}.jsonl`;

async function runAiMatching() {
    console.log(`🚀 Starting Matcher Part ${PART_ID} (Range: ${START}-${END})`);

    console.log('🔍 Finding images...');
    const allImages = findImages(PRIMARY_IMAGE_DIR);
    console.log(`Found ${allImages.length} images.`);

    console.log(`📦 Fetching products ${START} to ${END}...`);

    // Fetch directly using range
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug')
        .order('name')
        .range(START, END - 1); // Supabase range is inclusive

    if (error || !products) {
        console.error('Failed to fetch products:', error);
        return;
    }
    console.log(`Found ${products.length} products to process.`);

    // Clear previous output for this part
    fs.writeFileSync(OUTPUT_FILE, '');

    const BATCH_SIZE = 40;
    let totalMatched = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batchProducts = products.slice(i, i + BATCH_SIZE);
        console.log(`\n🤖 [Part ${PART_ID}] Processing batch ${i + 1}-${Math.min(i + BATCH_SIZE, products.length)}...`);

        try {
            const { object } = await generateObject({
                model,
                schema: z.object({
                    matches: z.array(z.object({
                        productId: z.string(),
                        productName: z.string(),
                        matchedImageFilename: z.string().nullable(),
                        confidence: z.number(),
                        reasoning: z.string()
                    }))
                }),
                prompt: `
                Match products to images.
                
                Product List:
                ${JSON.stringify(batchProducts.map(p => ({ id: p.id, name: p.name })), null, 2)}
                
                Available Images (search list):
                ${JSON.stringify(allImages)}
                
                Task:
                Find the BEST matching image filename for each product.
                - EXACT model match required (e.g. 'Spark 40' != 'Spark 30').
                - Match BRAND, MODEL, COLOR.
                - Use NULL if no good match.
                `
            });

            const validMatches = object.matches.filter(m => m.matchedImageFilename);
            totalMatched += validMatches.length;

            const lines = object.matches.map(m => JSON.stringify(m)).join('\n') + '\n';
            fs.appendFileSync(OUTPUT_FILE, lines);

            console.log(`   ✅ [Part ${PART_ID}] Matched ${validMatches.length}/${batchProducts.length}. Total: ${totalMatched}`);

            // Reduced delay for parallel speed
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (e) {
            console.error(`   ❌ [Part ${PART_ID}] Batch failed:`, e);
        }
    }

    console.log(`\n🎉 [Part ${PART_ID}] Finished! Saved to ${OUTPUT_FILE}`);
}

runAiMatching();
