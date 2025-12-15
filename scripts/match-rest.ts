import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

dotenv.config({ path: '.env.local' });

// --- Configuration ---
const BATCH_SIZE = 40; // Products per batch
const IMG_DIR = '/Users/mac/Baci-app/Baci/public/website designs';
const PREVIOUS_MATCH_FILES = [
    'scripts/ai_matches_part1.jsonl',
    'scripts/ai_matches_part2.jsonl',
    'scripts/ai_matches_part3.jsonl'
];
const OUTPUT_FILE = 'scripts/ai_matches_phase2.jsonl';

// --- Init ---
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
console.log(`🔑 API Key Status: ${apiKey ? 'Loaded (' + apiKey.substring(0, 4) + '...)' : 'MISSING'}`);

if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY or GOOGLE_GENAI_API_KEY not found in .env.local');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    productId: { type: SchemaType.STRING },
                    productName: { type: SchemaType.STRING },
                    matchedImageFilename: { type: SchemaType.STRING, nullable: true },
                    confidence: { type: SchemaType.NUMBER }
                },
                required: ["productId", "productName", "confidence"]
            }
        }
    }
});

function getAllImages(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllImages(filePath));
        } else {
            if (!file.startsWith('.')) results.push(filePath);
        }
    });
    return results;
}

async function matchRest() {
    console.log('🚀 Starting Phase 2: Matching the Rest...');

    // 1. Get Unmatched Products
    console.log('   Fetching products...');
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, slug, images');

    // Unmatched = Empty images array OR images[0] is null
    const unmatchedProducts = allProducts?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null) || [];
    console.log(`\n📉 Unmatched Products: ${unmatchedProducts.length}`);

    if (unmatchedProducts.length === 0) {
        console.log('✨ No unmatched products found! We are done.');
        return;
    }

    // 2. Get Unused Images
    const allImages = getAllImages(IMG_DIR);
    const usedImageFilenames = new Set<string>();

    PREVIOUS_MATCH_FILES.forEach(f => {
        if (fs.existsSync(f)) {
            const content = fs.readFileSync(f, 'utf-8');
            content.split('\n').forEach(line => {
                if (!line.trim()) return;
                try {
                    const json = JSON.parse(line);
                    if (json.matchedImageFilename) {
                        usedImageFilenames.add(path.basename(json.matchedImageFilename));
                    }
                } catch (e) { }
            });
        }
    });

    // Also check Phase 2 file if restarting
    if (fs.existsSync(OUTPUT_FILE)) {
        const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        content.split('\n').forEach(line => {
            if (!line.trim()) return;
            try {
                const json = JSON.parse(line);
                if (json.matchedImageFilename) usedImageFilenames.add(path.basename(json.matchedImageFilename));
            } catch (e) { }
        });
    }

    const unusedImages = allImages.filter(img => !usedImageFilenames.has(path.basename(img)));
    console.log(`✨ Unused Images Available: ${unusedImages.length}`);

    if (unusedImages.length === 0) {
        console.log('⚠️ No unused images left to match against.');
        return;
    }

    // 3. Prepare Prompt List (Filenames only to save tokens)
    const imageList = unusedImages.map(p => path.basename(p));

    // 4. Batch Process
    const batches = [];
    for (let i = 0; i < unmatchedProducts.length; i += BATCH_SIZE) {
        batches.push(unmatchedProducts.slice(i, i + BATCH_SIZE));
    }

    console.log(`\n📦 Processing ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`   ► Batch ${i + 1}/${batches.length} (${batch.length} products)...`);

        const prompt = `
        You are an expert product matcher.
        Task: Match the following UNMATCHED PRODUCTS to the provided UNUSED IMAGE FILENAMES.
        
        Rules:
        1. Match conservatively but intelligently (e.g. "iPhone 13" matches "iphone-13-red.jpg").
        2. Ignore color differences if it's the only remaining option for that model.
        3. If no image fits, return null.
        
        UNUSED IMAGES:
        ${JSON.stringify(imageList)}

        PRODUCTS TO MATCH:
        ${JSON.stringify(batch.map(p => ({ id: p.id, name: p.name, slug: p.slug })))}
        `;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const matches = JSON.parse(responseText);

            // Append to file immediately
            const toSave = matches.map((m: any) => {
                // Find full path
                let fullPath = null;
                if (m.matchedImageFilename) {
                    const match = unusedImages.find(img => path.basename(img) === m.matchedImageFilename);
                    if (match) fullPath = match;
                }
                return {
                    productId: m.productId,
                    productName: m.productName,
                    matchedImageFilename: fullPath, // Store full path
                    confidence: m.confidence
                };
            });

            const jsonl = toSave.map((m: any) => JSON.stringify(m)).join('\n') + '\n';
            fs.appendFileSync(OUTPUT_FILE, jsonl);
            console.log(`      ✅ Saved ${matches.length} results.`);

        } catch (e) {
            console.error(`      ❌ Batch failed:`, e);
        }

        // Rate limit pause
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n🎉 Phase 2 Matching Complete!');
}

matchRest();
