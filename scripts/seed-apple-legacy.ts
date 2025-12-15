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

// ------------------------------------------------------------------
// 1. DATA: Legacy Apple Specs Map
// ------------------------------------------------------------------
const APPLE_LEGACY_SPECS: Record<string, { display: string; processor: string; camera: string; battery: string; os: string; colors: string[]; features: string[] }> = {
    'X': {
        display: '5.8" Super Retina OLED',
        processor: 'A11 Bionic',
        camera: '12MP Dual Camera',
        battery: '2716mAh',
        os: 'iOS 11 (Upgradable to iOS 16)',
        colors: ['Space Gray', 'Silver'],
        features: ['Face ID', 'Wireless Charging', 'OLED Display', 'True Tone']
    },
    'XR': {
        display: '6.1" Liquid Retina LCD',
        processor: 'A12 Bionic',
        camera: '12MP Wide Camera',
        battery: '2942mAh',
        os: 'iOS 12 (Upgradable to iOS 17)',
        colors: ['Blue', 'White', 'Black', 'Yellow', 'Coral', 'Red'],
        features: ['Face ID', 'Wireless Charging', 'Haptic Touch', 'Dual SIM (eSIM)']
    },
    'XS': {
        display: '5.8" Super Retina OLED',
        processor: 'A12 Bionic',
        camera: '12MP Dual Camera',
        battery: '2658mAh',
        os: 'iOS 12 (Upgradable to iOS 17)',
        colors: ['Gold', 'Space Gray', 'Silver'],
        features: ['Face ID', 'Wireless Charging', 'Dual SIM (eSIM)', 'IP68 Water Resistant']
    },
    'XS Max': {
        display: '6.5" Super Retina OLED',
        processor: 'A12 Bionic',
        camera: '12MP Dual Camera',
        battery: '3174mAh',
        os: 'iOS 12 (Upgradable to iOS 17)',
        colors: ['Gold', 'Space Gray', 'Silver'],
        features: ['Face ID', 'Wireless Charging', 'Dual SIM (eSIM)', 'IP68 Water Resistant']
    },
    '8': {
        display: '4.7" Retina HD LCD',
        processor: 'A11 Bionic',
        camera: '12MP Wide Camera',
        battery: '1821mAh',
        os: 'iOS 11 (Upgradable to iOS 16)',
        colors: ['Gold', 'Silver', 'Space Gray', 'Red'],
        features: ['Touch ID', 'Wireless Charging', 'True Tone', '4K Video']
    },
    '8 Plus': {
        display: '5.5" Retina HD LCD',
        processor: 'A11 Bionic',
        camera: '12MP Dual Camera',
        battery: '2691mAh',
        os: 'iOS 11 (Upgradable to iOS 16)',
        colors: ['Gold', 'Silver', 'Space Gray', 'Red'],
        features: ['Touch ID', 'Wireless Charging', 'Portrait Mode', '4K Video']
    },
    'SE (2nd Gen)': {
        display: '4.7" Retina HD LCD',
        processor: 'A13 Bionic',
        camera: '12MP Wide Camera',
        battery: '1821mAh',
        os: 'iOS 13 (Upgradable to iOS 17)',
        colors: ['Black', 'White', 'Red'],
        features: ['Touch ID', 'Wireless Charging', 'Portrait Mode', 'Compact Design']
    },
    'SE (3rd Gen)': {
        display: '4.7" Retina HD LCD',
        processor: 'A15 Bionic',
        camera: '12MP Wide Camera',
        battery: '2018mAh',
        os: 'iOS 15 (Upgradable to iOS 18)',
        colors: ['Midnight', 'Starlight', 'Red'],
        features: ['Touch ID', '5G Capable', 'Wireless Charging', 'Smart HDR 4']
    }
};

// ------------------------------------------------------------------
// 2. DATA: Legacy Inventory to Seed (UK Used)
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // iPhone X (UK Used)
    { model: 'X', storage: '64GB', ram: '3GB', condition: 'UK Used', price: 180000 },
    { model: 'X', storage: '256GB', ram: '3GB', condition: 'UK Used', price: 220000 },

    // iPhone XR (UK Used)
    { model: 'XR', storage: '64GB', ram: '3GB', condition: 'UK Used', price: 200000 },
    { model: 'XR', storage: '128GB', ram: '3GB', condition: 'UK Used', price: 230000 },

    // iPhone XS (UK Used)
    { model: 'XS', storage: '64GB', ram: '4GB', condition: 'UK Used', price: 210000 },
    { model: 'XS', storage: '256GB', ram: '4GB', condition: 'UK Used', price: 250000 },

    // iPhone XS Max (UK Used)
    { model: 'XS Max', storage: '64GB', ram: '4GB', condition: 'UK Used', price: 250000 },
    { model: 'XS Max', storage: '256GB', ram: '4GB', condition: 'UK Used', price: 300000 },

    // iPhone 8 (UK Used)
    { model: '8', storage: '64GB', ram: '2GB', condition: 'UK Used', price: 120000 },
    { model: '8', storage: '256GB', ram: '2GB', condition: 'UK Used', price: 150000 },

    // iPhone 8 Plus (UK Used)
    { model: '8 Plus', storage: '64GB', ram: '3GB', condition: 'UK Used', price: 150000 },
    { model: '8 Plus', storage: '256GB', ram: '3GB', condition: 'UK Used', price: 180000 },

    // iPhone SE 2nd Gen (UK Used)
    { model: 'SE (2nd Gen)', storage: '64GB', ram: '3GB', condition: 'UK Used', price: 160000 },
    { model: 'SE (2nd Gen)', storage: '128GB', ram: '3GB', condition: 'UK Used', price: 180000 },

    // iPhone SE 3rd Gen (UK Used & New)
    { model: 'SE (3rd Gen)', storage: '64GB', ram: '4GB', condition: 'UK Used', price: 280000 },
    { model: 'SE (3rd Gen)', storage: '128GB', ram: '4GB', condition: 'UK Used', price: 320000 },
    { model: 'SE (3rd Gen)', storage: '128GB', ram: '4GB', condition: 'New', price: 420000 }
];


// ------------------------------------------------------------------
// 3. LOGIC: Description Generator
// ------------------------------------------------------------------
function generateDescription(model: string, name: string, price: number, condition: string, metadata: any, specs: any) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);

    return `
## iPhone ${model} Price in Nigeria

The **${name}** is available at Ogabassey for **${priceStr}**. Powered by the **${specs.processor}** and featuring a **${specs.display}**, this ${metadata.storage} model offers reliable Apple performance at an affordable price. This device is **${condition}** and ready for immediate delivery.

## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | iPhone ${model} |
| **Condition** | ${condition} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **RAM** | ${metadata.ram} |
| **Storage** | ${metadata.storage} |
| **Main Camera** | ${specs.camera} |
| **Battery** | ${specs.battery} |
| **OS** | ${specs.os} |
| **Features** | ${specs.features ? specs.features.join(', ') : 'Touch ID, 4K Video'} |
| **Available Colors** | ${specs.colors ? specs.colors.join(', ') : 'Various'} |

## Why Buy from Ogabassey?

- ✅ **Affordable Entry:** Premium Apple experience at budget-friendly prices
- ✅ **Guaranteed Quality:** ${condition === 'New' ? 'Brand New (Sealed)' : 'Verified Authentic UK Used - 30-Point Check'}
- ✅ **Flexible Payment:** Pay in full OR pay small-small (BNPL)
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 6-month warranty & 7-day return policy

## Related Products

- [iPhone 11](/apple) - Modern Upgrade
- [iPhone SE (3rd Gen)](/apple) - Compact Powerhouse
- [iPhone 13](/apple) - Latest Generation Value
`;
}


// ------------------------------------------------------------------
// 4. MAIN Script
// ------------------------------------------------------------------
async function seedLegacyAppleProducts() {
    console.log("🍏 Starting Legacy Apple/iPhone Seeding...");

    // A. Get Apple Category
    console.log("📂 Fetching 'Apple' Category...");
    const { data: catData } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'apple').maybeSingle();

    if (!catData) {
        console.error("❌ 'Apple' category not found. Run seed-apple.ts first.");
        return;
    }

    const categoryId = catData.id;
    const merchantId = catData.merchant_id;
    console.log("✅ Found Apple Category:", categoryId);

    // B. Seed Products
    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} Legacy Apple products...`);

    for (const p of PRODUCTS_TO_SEED) {
        const specs = APPLE_LEGACY_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs found for iPhone ${p.model}, skipping.`);
            continue;
        }

        const fullName = `iPhone ${p.model} ${p.ram} ${p.storage} (${p.condition})`;
        const metadata = {
            brand: 'Apple',
            model: p.model,
            ram: p.ram,
            storage: p.storage,
            condition: p.condition,
            sim_type: p.model.includes('XR') || p.model.includes('XS') || p.model.includes('SE') ? 'Nano-SIM + eSIM' : 'Nano-SIM'
        };

        // Determine Pricing based on Tiered Rules
        // Rule: > 450k = 10%, 200k-445k = 15%, < 200k = 20%
        const costPrice = p.price;
        let markup = 1.20; // Default < 200k

        if (costPrice > 450000) {
            markup = 1.10;
        } else if (costPrice >= 200000) {
            markup = 1.15;
        }

        let retailPrice = costPrice * markup;
        retailPrice = Math.ceil(retailPrice / 100) * 100; // Round to nearest 100

        const description = generateDescription(p.model, fullName, retailPrice, p.condition, metadata, specs);

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('name', fullName).maybeSingle();

        // DB Constraint: 'new' or 'used'
        const dbCondition = p.condition.toLowerCase() === 'new' ? 'new' : 'used';

        if (existing) {
            console.log(`   ⏩ Skipping existing: ${fullName}`);
            await supabase.from('product_categories').upsert({ product_id: existing.id, category_id: categoryId });
        } else {
            console.log(`   ✨ Creating: ${fullName}`);
            console.log(`      Cost: ₦${costPrice.toLocaleString()}, Markup: ${((markup - 1) * 100).toFixed(0)}%, Retail: ₦${retailPrice.toLocaleString()}`);

            const { data: newProd, error: insertError } = await supabase
                .from('products')
                .insert({
                    name: fullName,
                    slug: fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                    merchant_id: merchantId,
                    price: retailPrice,
                    cost_price: costPrice,
                    compare_at_price: Math.floor(retailPrice * 1.08), // 8% fake discount
                    description: description,
                    metadata: metadata,
                    category: 'Apple',
                    status: 'active',
                    stock: 3, // Lower stock for older models
                    condition: dbCondition
                })
                .select()
                .single();

            if (insertError) {
                console.error(`   ❌ Failed to insert ${fullName}:`, insertError);
            } else {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
                console.log(`   ✅ Created & Linked`);
            }
        }
    }

    console.log("🏁 Legacy Apple Seeding Complete!");
}

seedLegacyAppleProducts().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
