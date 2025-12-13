import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const CDN_BASE_URL = 'https://cdn.ogabassey.com/products';
const OUT_DIR = path.join(process.cwd(), 'ready_for_upload');

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR);
}

async function prepare() {
    console.log('📦 Preparing Apple Images for Manual Upload...');

    const appleDir = path.join(process.cwd(), 'apple_downloaded_images');
    
    // Fetch products
    const { data: appleProducts } = await supabase
        .from('products')
        .select('id, name, slug')
        .or('brand.ilike.Apple,name.ilike.%Apple%,name.ilike.%iPhone%,name.ilike.%MacBook%,name.ilike.%iPad%,name.ilike.%Watch%');
        
    console.log(`Found ${appleProducts?.length || 0} Apple products in DB.`);

    const appleFiles = fs.readdirSync(appleDir).filter(f => f.startsWith('branded_') && f.endsWith('.png'));
    let preparedCount = 0;
    
    for (const file of appleFiles) {
        const cleanName = file.replace('branded_', '').toLowerCase();
        
        let bestMatch = null;
        let maxScore = 0;
        
        const candidates = appleProducts?.filter(p => {
             const lowerName = p.name.toLowerCase();
             if (cleanName.includes('iphone') && !lowerName.includes('iphone')) return false;
             if (cleanName.includes('macbook') && !lowerName.includes('macbook')) return false;
             if (cleanName.includes('ipad') && !lowerName.includes('ipad')) return false;
             if (cleanName.includes('watch') && !lowerName.includes('watch')) return false;
             return true;
        }) || [];

        for (const p of candidates) {
            let score = 0;
            const pName = p.name.toLowerCase();
            
            // 1. Model Matching
            if (cleanName.includes('iphone-17') && pName.includes('17')) score += 20;
            if (cleanName.includes('iphone-16') && pName.includes('16')) score += 20;
            if (cleanName.includes('iphone-16e') && pName.includes('16e')) score += 25; 
            if (cleanName.includes('iphone-air') && pName.includes('iphone air')) score += 25; 
            
            if (cleanName.includes('pro max') && pName.includes('pro max')) score += 10;
            else if (cleanName.includes('pro') && !cleanName.includes('max') && pName.includes('pro') && !pName.includes('max')) score += 10;
            
            // iPad models
            if (cleanName.includes('ipad') && pName.includes('ipad')) {
                 if (cleanName.includes('air') && pName.includes('air')) score += 15;
                 if (cleanName.includes('pro') && pName.includes('pro')) score += 15;
                 if (cleanName.includes('mini') && pName.includes('mini')) score += 15;
                 if (cleanName.includes('10th') && (pName.includes('10th') || pName.includes('10.9'))) score += 15;
            }
            // Watch models
            if (cleanName.includes('watch') && pName.includes('watch')) score += 10;
            if (cleanName.includes('s11') && (pName.includes('series 11') || pName.includes('series 10'))) score += 5;
            // MacBook models
            if (cleanName.includes('macbook-air') && pName.includes('air')) score += 15;
            if (cleanName.includes('m4') && pName.includes('m4')) score += 5;

            // 2. Color Matching
            const colors = ['silver', 'titanium', 'orange', 'blue', 'white', 'black', 'gold', 'gray', 'midnight', 'starlight', 'space gray', 'cloud white', 'light gold', 'sky blue'];
            for (const color of colors) {
                const cleanColor = color.replace(' ', '');
                if ((cleanName.includes(cleanColor) || cleanName.includes(color)) && pName.includes(color)) {
                    score += 5;
                }
            }

            if (score > maxScore) {
                maxScore = score;
                bestMatch = p;
            }
        }
        
        if (bestMatch && maxScore >= 15) {
            const destFilename = `${bestMatch.id}.png`;
            const destPath = path.join(OUT_DIR, destFilename);
            const srcPath = path.join(appleDir, file);
            
            console.log(`✅ MATCH: ${file} -> ${bestMatch.name}`);
            
            // Copy file
            fs.copyFileSync(srcPath, destPath);
            
            // Update DB
            const publicUrl = `${CDN_BASE_URL}/${destFilename}`;
            const { error } = await supabase
                .from('products')
                .update({ image: publicUrl, images: [publicUrl] })
                .eq('id', bestMatch.id);
                
            if (error) console.error(`Failed to update DB for ${bestMatch.name}:`, error);
            else console.log(`   Updated DB URL: ${publicUrl}`);
            
            preparedCount++;
        }
    }

    console.log(`\n🎉 Processed ${preparedCount} images.`);
    console.log(`Files are in: ${OUT_DIR}`);
}

prepare();
