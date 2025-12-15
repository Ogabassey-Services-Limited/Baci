import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('🔍 Analyzing Samsung Galaxy S24 Family...');

    // 1. Fetch all S24 products
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%Galaxy S24%')
        .neq('status', 'archived')
        .order('name');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`📊 Found ${products.length} active S24 products.`);

    // 2. Scan for images
    const sourceDirs = [
        path.join(process.cwd(), 'public/website designs/SAMSUNG'),
        path.join(process.cwd(), 'public/website designs/LAPTOPS AND OTHERS')
    ];

    const images: string[] = [];

    function scanDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                scanDir(fullPath);
            } else if (file.toLowerCase().includes('s24') && /\.(jpg|jpeg|png|webp|avif)$/i.test(file)) {
                images.push(file);
            }
        }
    }

    sourceDirs.forEach(scanDir);
    console.log(`🖼️ Found ${images.length} potential S24 images in local folders.`);

    // 3. Grouping Logic Proposal
    const groups: Record<string, typeof products> = {
        'Samsung Galaxy S24 Ultra': [],
        'Samsung Galaxy S24 Plus': [],
        'Samsung Galaxy S24': [] // Base model
    };

    products.forEach(p => {
        if (p.name.toLowerCase().includes('ultra')) {
            groups['Samsung Galaxy S24 Ultra'].push(p);
        } else if (p.name.toLowerCase().includes('plus') || p.name.includes('+')) {
            groups['Samsung Galaxy S24 Plus'].push(p);
        } else {
            groups['Samsung Galaxy S24'].push(p);
        }
    });

    console.log('\n--- Proposed Grouping ---');
    for (const [group, items] of Object.entries(groups)) {
        console.log(`${group}: ${items.length} variants found.`);
        if (items.length > 0) {
            console.log(`   Sample: ${items[0].name}`);
        }
    }

    console.log('\n--- Image Samples ---');
    console.log(images.slice(0, 5));

}

main().catch(console.error);
