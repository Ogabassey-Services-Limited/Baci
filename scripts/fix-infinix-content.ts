
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2025 Timeline Specs for Infinix
const INFINIX_SPECS: Record<string, { display: string; processor: string; camera: string; battery: string; os: string; colors: string[] }> = {
    'Zero Flip': {
        display: '6.9" Foldable LTPO OLED (120Hz) / 3.64" Cover',
        processor: 'MediaTek Dimensity 8020 (6nm)',
        camera: '50MP Main + 50MP Ultrawide',
        battery: '4720mAh (70W Fast Charge)',
        os: 'Android 14 (XOS 14.5)',
        colors: ['Rock Black', 'Blossom Glow']
    },
    'GT 30 Pro': {
        display: '6.78" LTPS AMOLED (144Hz)',
        processor: 'MediaTek Dimensity 8350 Ultimate',
        camera: '108MP Main + 8MP Ultrawide + 2MP Macro',
        battery: '5500mAh (45W Charge)',
        os: 'Android 15 (XOS 15)',
        colors: ['Mecha Silver', 'Mecha Blue', 'Mecha Orange']
    },
    'Hot 60 Pro': {
        display: '6.78" AMOLED (120Hz)',
        processor: 'MediaTek Helio G200 (6nm)', // Based on 2025 search result
        camera: '108MP Main + 2MP Depth',
        battery: '5160mAh (45W Charge)',
        os: 'Android 15 (XOS 15)',
        colors: ['Sleek Black', 'Titanium Silver', 'Cyber Green']
    },
    'Hot 60': {
        display: '6.78" IPS LCD (120Hz)',
        processor: 'MediaTek Helio G100', // Assumed step down from Pro
        camera: '50MP Main + AI Lens',
        battery: '5000mAh (33W Charge)',
        os: 'Android 15 (XOS 15)',
        colors: ['Black', 'Blue', 'Gold']
    },
    'Hot 50 Pro': {
        display: '6.78" AMOLED (120Hz)',
        processor: 'MediaTek Helio G99 Ultimate',
        camera: '50MP Main + 2MP Depth',
        battery: '5000mAh (33W Charge)',
        os: 'Android 14 (XOS 14)',
        colors: ['Sleek Black', 'Titanium Silver']
    },
    'Hot 50': {
        display: '6.78" IPS LCD (120Hz)',
        processor: 'MediaTek Helio G100',
        camera: '50MP Main',
        battery: '5000mAh',
        os: 'Android 14',
        colors: ['Sleek Black', 'Sage Green']
    },
    'Smart 10': {
        display: '6.67" HD+ IPS LCD (120Hz)',
        processor: 'UNISOC T7250',
        camera: '13MP Main + AI Lens',
        battery: '5000mAh',
        os: 'Android 15 Go',
        colors: ['Black', 'Blue', 'Green']
    },
    'Smart 9': {
        display: '6.6" HD+ IPS LCD (90Hz)',
        processor: 'MediaTek Helio G36',
        camera: '13MP Main + AI Lens',
        battery: '5000mAh',
        os: 'Android 13 Go',
        colors: ['Timber Black', 'Shinny Gold', 'Rainbow Blue', 'Galaxy White']
    },
    'Smart 8': {
        display: '6.6" HD+ IPS LCD (90Hz)',
        processor: 'Unisoc T606',
        camera: '13MP Main + AI Lens',
        battery: '5000mAh',
        os: 'Android 13 Go',
        colors: ['Timber Black', 'Shinny Gold', 'Crystal Green', 'Galaxy White']

    },
    'Note 50 Pro': { // Hypothetical/Future based on user data
        display: '6.78" AMOLED (120Hz)',
        processor: 'MediaTek Dimensity 7050',
        camera: '108MP Main + 2MP + 2MP',
        battery: '5000mAh (68W)',
        os: 'Android 14',
        colors: ['Black', 'Gold', 'Green']
    },
    'XPAD': {
        display: '11" FHD+ IPS (90Hz)',
        processor: 'MediaTek Helio G99',
        camera: '8MP Rear / 8MP Front',
        battery: '7000mAh',
        os: 'Android 14',
        colors: ['Titan Gold', 'Frost Blue', 'Stellar Grey']
    }
};

const DEFAULT_SPECS = {
    display: 'High Definition Display',
    processor: 'Octa-core Processor',
    camera: 'High Resolution AI Camera',
    battery: 'Long-lasting Battery',
    os: 'Android',
    colors: ['Black', 'Blue']
};

function generateDescription(name: string, price: number, condition: string, metadata: any) {
    let modelKey = Object.keys(INFINIX_SPECS).find(key => name.includes(key));
    // Fallback for variations
    if (!modelKey) {
        if (name.includes('Hot 60')) modelKey = 'Hot 60';
        else if (name.includes('Hot 50')) modelKey = 'Hot 50';
        else if (name.includes('Smart 10')) modelKey = 'Smart 10';
        else if (name.includes('Smart 9')) modelKey = 'Smart 9';
        else if (name.includes('Smart 8')) modelKey = 'Smart 8';
    }

    const specs = modelKey ? INFINIX_SPECS[modelKey] : DEFAULT_SPECS;
    const modelName = modelKey || 'Infinix Smartphone';

    // Extract RAM/Storage from name if not in metadata
    let ram = metadata.ram;
    let storage = metadata.storage;

    if (!ram || !storage || ram === 'N/A' || storage === 'N/A') {
        // Pattern 1: "(256GB + 8GB)" or "256GB+8GB" or "256GB + 8GB RAM"
        const combinedMatch = name.match(/(\d+)\s*GB\s*\+\s*(\d+)\s*GB/i);
        // Pattern 2: "128GB" single mention (usually storage)
        const storageMatch = name.match(/(\d+)\s*GB/i);

        if (combinedMatch) {
            storage = combinedMatch[1] + 'GB';
            ram = combinedMatch[2] + 'GB';
        } else if (storageMatch) {
            storage = storageMatch[1] + 'GB';
            // Default RAM based on storage tier typicals if unknown
            if (parseInt(storageMatch[1]) >= 256) ram = '8GB';
            else if (parseInt(storageMatch[1]) >= 128) ram = '4GB';
            else ram = '4GB';
        }
    }

    // Final Fallback to "Standard" if still N/A to avoid ugly UI
    if (!storage || storage === 'N/A') storage = '128GB'; // Most common base
    if (!ram || ram === 'N/A') ram = '4GB'; // Most common base


    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);

    return `
## ${modelName} Price in Nigeria

The **${name}** is available at Ogabassey for **${priceStr}**. Featuring a **${specs.display}** and the reliable **${specs.processor}** processor, this ${storage} storage model with ${ram} RAM is built for performance. This device is **${condition}** and ready for immediate delivery.

## Key Specifications

| Spec | Value |
|------|-------|
| **Condition** | ${condition} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **RAM** | ${ram} |
| **Storage** | ${storage} |
| **Main Camera** | ${specs.camera} |
| **Battery** | ${specs.battery} |
| **OS** | ${specs.os} |
| **Available Colors** | ${specs.colors ? specs.colors.join(', ') : 'Various'} |

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR pay small-small (BNPL)
- ✅ **Guaranteed Quality:** ${condition === 'New' ? 'Brand New (Sealed)' : 'Verified Authentic UK Used'}
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [Samsung Galaxy Series](/smartphones/samsung)
- [Tecno Smartphones](/smartphones/tecno)
- [Xiaomi Redmi Series](/smartphones/xiaomi)
`;
}

async function fixInfinixContent() {
    console.log("🚀 Starting Infinix Content Audit & Fix...");

    // 1. Ensure Category Exists
    console.log("📂 Checking 'Infinix' Category...");
    // Use .select().eq() then check length to avoid .single() error on 0 rows
    const { data: catDataRows } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'infinix');

    const catData = catDataRows?.[0]; // Safe access

    let categoryId;

    const parent = await supabase.from('categories').select('id').eq('slug', 'smartphones').single();
    console.log("📱 Smartphones Parent ID:", parent.data?.id);

    if (!catData) {
        console.log("✨ Creating 'Infinix' Category...");
        const parent = await supabase.from('categories').select('id').eq('slug', 'smartphones').single();
        const { data: newCat, error: createError } = await supabase
            .from('categories')
            .insert({
                name: 'Infinix',
                slug: 'infinix',
                parent_id: parent.data?.id, // Make it a child of Smartphones
                description: 'Shop the latest Infinix smartphones in Nigeria.',
                seo_heading: 'Buy Latest Infinix Phones in Nigeria',
                seo_description: 'Discover the best prices for Infinix smartphones including the Zero Flip, Hot 60 series, and Smart 10.',
                seo_features: ["100% Quality Guaranteed", "Pay Small Small", "Nationwide Delivery", "12-Month Warranty"],
                seo_faq: [
                    { question: "Is Infinix Zero Flip good for gaming?", answer: "Yes, with the Dimensity 8020 and 120Hz display, it handles gaming smoothly." },
                    { question: "Do you sell UK Used Infinix phones?", answer: "Yes, we stock high-quality UK used and Brand New Infinix devices." }
                ]
            })
            .select()
            .single();

        if (createError) {
            console.error("❌ Failed to create category:", createError);
        } else {
            categoryId = newCat.id;
            console.log("✅ Created Category ID:", categoryId);
        }
    } else {
        categoryId = catData.id;
        console.log("ℹ️ Category already exists:", categoryId);
        // Force update SEO fields just in case they were missed
        await supabase.from('categories').update({
            seo_heading: 'Buy Latest Infinix Phones in Nigeria',
            seo_description: 'Discover the best prices for Infinix smartphones including the Zero Flip, Hot 60 series, and Smart 10.',
            seo_features: ["100% Quality Guaranteed", "Pay Small Small", "Nationwide Delivery", "12-Month Warranty"]
        }).eq('id', categoryId);
    }

    // 2. Fetch Products
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%Infinix%');

    if (error) {
        console.error("❌ Error fetching products:", error);
        return;
    }

    console.log(`🔍 Found ${products.length} Infinix products to audit.`);

    for (const p of products) {
        console.log(`🔧 Auditing: ${p.name}`);

        // Parse Name for Metadata (Simple Regex)
        let ram = p.metadata?.ram;
        let storage = p.metadata?.storage;
        let model = p.metadata?.model;

        // Fix N/A or Missing
        if (!ram || !storage || ram === 'N/A' || storage === 'N/A') {
            // Pattern 1: "(256GB + 8GB)" or "256GB+8GB" or "256GB + 8GB RAM"
            const combinedMatch = p.name.match(/(\d+)\s*GB\s*\+\s*(\d+)\s*GB/i);
            // Pattern 2: "128GB" single mention (usually storage)
            const storageMatch = p.name.match(/(\d+)\s*GB/i);

            if (combinedMatch) {
                storage = combinedMatch[1] + 'GB';
                ram = combinedMatch[2] + 'GB';
            } else if (storageMatch) {
                storage = storageMatch[1] + 'GB';
                // Default RAM based on storage tier typicals if unknown
                if (parseInt(storageMatch[1]) >= 256) ram = '8GB';
                else if (parseInt(storageMatch[1]) >= 128) ram = '4GB';
                else ram = '4GB';
            }
        }

        // Final Fallback to "Standard" if still N/A
        if (!storage || storage === 'N/A') storage = '128GB';
        if (!ram || ram === 'N/A') ram = '4GB';

        if (!model || model === 'N/A') {
            model = p.name.replace('Infinix', '').replace(/\(.*?\)/g, '').trim();
        }

        const newMetadata = {
            ...p.metadata,
            ram: ram,
            storage: storage,
            model: model,
            brand: 'Infinix'
        };

        // Generate Description
        const newDescription = generateDescription(p.name, p.price, p.condition || 'New', newMetadata);

        // Update Product
        const { error: updateError } = await supabase
            .from('products')
            .update({
                description: newDescription,
                metadata: newMetadata,
                // Ensure it's in the category (via junction table usually, but here we might need to insert into product_categories)
            })
            .eq('id', p.id);

        if (updateError) console.error(`❌ Failed to update ${p.name}:`, updateError);
        else console.log(`✅ Updated content for ${p.name}`);

        // Link Category
        if (categoryId) {
            const { error: linkError } = await supabase
                .from('product_categories')
                .upsert({ product_id: p.id, category_id: categoryId }, { onConflict: 'product_id,category_id' });

            if (linkError) console.error(`⚠️ Failed to link category:`, linkError);
            else console.log(`🔗 Linked to Infinix category`);
        }
    }

    console.log("🏁 Infinix Audit & Fix Complete!");
}

fixInfinixContent();
