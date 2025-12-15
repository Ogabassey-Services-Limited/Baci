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
// 1. DATA: Apple Specs Map (2025 Comprehensive)
// ------------------------------------------------------------------
const APPLE_SPECS: Record<string, { display: string; processor: string; camera: string; battery: string; os: string; colors: string[]; features: string[] }> = {
    '16 Pro Max': {
        display: '6.9" Super Retina XDR OLED (120Hz ProMotion)',
        processor: 'A18 Pro Chip (3nm)',
        camera: '48MP Fusion + 48MP Ultra Wide + 12MP 5x Telephoto',
        battery: '4685mAh (Max Battery Life)',
        os: 'iOS 18',
        colors: ['Desert Titanium', 'Natural Titanium', 'White Titanium', 'Black Titanium'],
        features: ['Apple Intelligence', 'Camera Control Button', 'Dynamic Island', 'Action Button']
    },
    '16 Pro': {
        display: '6.3" Super Retina XDR OLED (120Hz ProMotion)',
        processor: 'A18 Pro Chip (3nm)',
        camera: '48MP Fusion + 48MP Ultra Wide + 12MP 5x Telephoto',
        battery: '3582mAh',
        os: 'iOS 18',
        colors: ['Desert Titanium', 'Natural Titanium', 'White Titanium', 'Black Titanium'],
        features: ['Apple Intelligence', 'Camera Control Button', 'Dynamic Island', 'Action Button']
    },
    '16 Plus': {
        display: '6.7" Super Retina XDR OLED (60Hz)',
        processor: 'A18 Chip',
        camera: '48MP Fusion + 12MP Ultra Wide',
        battery: '4674mAh',
        os: 'iOS 18',
        colors: ['Ultramarine', 'Teal', 'Pink', 'White', 'Black'],
        features: ['Apple Intelligence', 'Camera Control Button', 'Dynamic Island']
    },
    '16': {
        display: '6.1" Super Retina XDR OLED (60Hz)',
        processor: 'A18 Chip',
        camera: '48MP Fusion + 12MP Ultra Wide',
        battery: '3561mAh',
        os: 'iOS 18',
        colors: ['Ultramarine', 'Teal', 'Pink', 'White', 'Black'],
        features: ['Apple Intelligence', 'Camera Control Button', 'Dynamic Island']
    },
    '15 Pro Max': {
        display: '6.7" Super Retina XDR OLED (120Hz ProMotion)',
        processor: 'A17 Pro Chip',
        camera: '48MP Main + 12MP Ultra Wide + 12MP 5x Telephoto',
        battery: '4441mAh',
        os: 'iOS 17 (Upgradable)',
        colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
        features: ['Titanium Design', 'Action Button', 'Dynamic Island', 'USB-C']
    },
    '15 Pro': {
        display: '6.1" Super Retina XDR OLED (120Hz ProMotion)',
        processor: 'A17 Pro Chip',
        camera: '48MP Main + 12MP Ultra Wide + 12MP 3x Telephoto',
        battery: '3274mAh',
        os: 'iOS 17 (Upgradable)',
        colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
        features: ['Titanium Design', 'Action Button', 'Dynamic Island', 'USB-C']
    },
    '15 Plus': {
        display: '6.7" Super Retina XDR OLED',
        processor: 'A16 Bionic',
        camera: '48MP Main + 12MP Ultra Wide',
        battery: '4383mAh',
        os: 'iOS 17 (Upgradable)',
        colors: ['Pink', 'Yellow', 'Green', 'Blue', 'Black'],
        features: ['Dynamic Island', 'USB-C', 'Ceramic Shield']
    },
    '15': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A16 Bionic',
        camera: '48MP Main + 12MP Ultra Wide',
        battery: '3349mAh',
        os: 'iOS 17 (Upgradable)',
        colors: ['Pink', 'Yellow', 'Green', 'Blue', 'Black'],
        features: ['Dynamic Island', 'USB-C', 'Ceramic Shield']
    },
    '14 Pro Max': {
        display: '6.7" Super Retina XDR OLED (120Hz)',
        processor: 'A16 Bionic',
        camera: '48MP Main + 12MP Ultra Wide + 12MP Telephoto',
        battery: '4323mAh',
        os: 'iOS 16 (Upgradable)',
        colors: ['Deep Purple', 'Gold', 'Silver', 'Space Black'],
        features: ['Dynamic Island', 'Always-On Display', 'Crash Detection']
    },
    '14 Pro': {
        display: '6.1" Super Retina XDR OLED (120Hz)',
        processor: 'A16 Bionic',
        camera: '48MP Main + 12MP Ultra Wide + 12MP Telephoto',
        battery: '3200mAh',
        os: 'iOS 16 (Upgradable)',
        colors: ['Deep Purple', 'Gold', 'Silver', 'Space Black'],
        features: ['Dynamic Island', 'Always-On Display', 'Crash Detection']
    },
    '14 Plus': {
        display: '6.7" Super Retina XDR OLED',
        processor: 'A15 Bionic',
        camera: '12MP Main + 12MP Ultra Wide',
        battery: '4325mAh',
        os: 'iOS 16 (Upgradable)',
        colors: ['Blue', 'Purple', 'Midnight', 'Starlight', 'Red'],
        features: ['Ceramic Shield', 'Crash Detection', 'Long Battery Life']
    },
    '14': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A15 Bionic',
        camera: '12MP Main + 12MP Ultra Wide',
        battery: '3279mAh',
        os: 'iOS 16 (Upgradable)',
        colors: ['Blue', 'Purple', 'Midnight', 'Starlight', 'Red'],
        features: ['Ceramic Shield', 'Crash Detection']
    },
    '13 Pro Max': {
        display: '6.7" Super Retina XDR OLED (120Hz)',
        processor: 'A15 Bionic',
        camera: '12MP Main + 12MP Ultra Wide + 12MP Telephoto',
        battery: '4352mAh',
        os: 'iOS 15 (Upgradable)',
        colors: ['Sierra Blue', 'Graphite', 'Gold', 'Silver', 'Alpine Green'],
        features: ['ProMotion Display', 'Macro Photography', 'Cinematic Mode']
    },
    '13': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A15 Bionic',
        camera: '12MP Main + 12MP Ultra Wide',
        battery: '3240mAh',
        os: 'iOS 15 (Upgradable)',
        colors: ['Pink', 'Blue', 'Midnight', 'Starlight', 'Green', 'Red'],
        features: ['Cinematic Mode', 'Ceramic Shield', 'Dual Camera System']
    },
    '12 Pro Max': {
        display: '6.7" Super Retina XDR OLED',
        processor: 'A14 Bionic',
        camera: '12MP Triple Camera System + LiDAR',
        battery: '3687mAh',
        os: 'iOS 14 (Upgradable)',
        colors: ['Pacific Blue', 'Gold', 'Graphite', 'Silver'],
        features: ['LiDAR Scanner', 'Night Mode Portraits', 'Ceramic Shield']
    },
    '12': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A14 Bionic',
        camera: '12MP Dual Camera System',
        battery: '2815mAh',
        os: 'iOS 14 (Upgradable)',
        colors: ['Blue', 'Green', 'Red', 'White', 'Black', 'Purple'],
        features: ['5G Capable', 'Ceramic Shield', 'Night Mode']
    },
    '11': {
        display: '6.1" Liquid Retina HD LCD',
        processor: 'A13 Bionic',
        camera: '12MP Dual Camera System',
        battery: '3110mAh',
        os: 'iOS 13 (Upgradable)',
        colors: ['Purple', 'Green', 'Yellow', 'Black', 'White', 'Red'],
        features: ['Night Mode', '4K Video', 'Water Resistant']
    }
};

// ------------------------------------------------------------------
// 2. DATA: Inventory to Seed
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // iPhone 16 Series (New)
    { model: '16 Pro Max', storage: '1TB', ram: '8GB', condition: 'New', price: 2800000 },
    { model: '16 Pro Max', storage: '256GB', ram: '8GB', condition: 'New', price: 2400000 },
    { model: '16 Pro', storage: '256GB', ram: '8GB', condition: 'New', price: 2100000 },
    { model: '16', storage: '128GB', ram: '8GB', condition: 'New', price: 1600000 },

    // iPhone 15 Series (New & Used)
    { model: '15 Pro Max', storage: '256GB', ram: '8GB', condition: 'New', price: 1900000 },
    { model: '15 Pro Max', storage: '256GB', ram: '8GB', condition: 'UK Used', price: 1500000 },
    { model: '15 Pro', storage: '128GB', ram: '8GB', condition: 'UK Used', price: 1300000 },
    { model: '15', storage: '128GB', ram: '6GB', condition: 'UK Used', price: 1000000 },

    // iPhone 14 Series (Used)
    { model: '14 Pro Max', storage: '256GB', ram: '6GB', condition: 'UK Used', price: 1300000 },
    { model: '14 Pro', storage: '256GB', ram: '6GB', condition: 'UK Used', price: 1100000 },
    { model: '14', storage: '128GB', ram: '6GB', condition: 'UK Used', price: 850000 },

    // iPhone 13 Series (Used)
    { model: '13 Pro Max', storage: '256GB', ram: '6GB', condition: 'UK Used', price: 1050000 },
    { model: '13 Pro Max', storage: '128GB', ram: '6GB', condition: 'UK Used', price: 980000 },
    { model: '13', storage: '128GB', ram: '4GB', condition: 'UK Used', price: 650000 },

    // Legacy (Budget)
    { model: '12 Pro Max', storage: '128GB', ram: '6GB', condition: 'UK Used', price: 750000 },
    { model: '12', storage: '64GB', ram: '4GB', condition: 'UK Used', price: 450000 },
    { model: '11', storage: '64GB', ram: '4GB', condition: 'UK Used', price: 350000 }
];


// ------------------------------------------------------------------
// 3. LOGIC: Description Generator
// ------------------------------------------------------------------
function generateDescription(model: string, name: string, price: number, condition: string, metadata: any, specs: any) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);

    return `
## iPhone ${model} Price in Nigeria

The **${name}** is available at Ogabassey for **${priceStr}**. Powered by the **${specs.processor}** and featuring a **${specs.display}**, this ${metadata.storage} model offers premium Apple performance. This device is **${condition}** and ready for immediate delivery.

## Key Specifications

| Spec | Value |
|------|-------|
| **model** | iPhone ${model} |
| **Condition** | ${condition} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **RAM** | ${metadata.ram} |
| **Storage** | ${metadata.storage} |
| **Main Camera** | ${specs.camera} |
| **Battery** | ${specs.battery} |
| **OS** | ${specs.os} |
| **Features** | ${specs.features ? specs.features.join(', ') : 'Face ID, 5G, MagSafe'} |
| **Available Colors** | ${specs.colors ? specs.colors.join(', ') : 'Various'} |

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR pay small-small (BNPL)
- ✅ **Guaranteed Quality:** ${condition === 'New' ? 'Brand New (Sealed)' : 'Verified Authentic UK Used'}
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [Samsung Galaxy S24 Ultra](/smartphones/samsung) - Android Flagship
- [Google Pixel 9 Pro XL](/smartphones/google) - Pixel Alternative
`;
}


// ------------------------------------------------------------------
// 4. MAIN Script
// ------------------------------------------------------------------
async function seedAppleProducts() {
    console.log("🍏 Starting Apple/iPhone Seeding (Tiered Pricing)...");

    // A. Ensure Category 'Apple' Exists
    console.log("📂 Checking 'Apple' Category...");

    // Get Parent (Smartphones)
    const { data: parent } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'smartphones').single();
    if (!parent) {
        console.error("❌ 'Smartphones' category not found. Cannot proceed.");
        return;
    }

    // Check Apple Category
    const { data: catData } = await supabase.from('categories').select('id').eq('slug', 'apple').maybeSingle();

    let categoryId = catData?.id;

    if (!categoryId) {
        console.log("✨ Creating 'Apple' Category...");
        const { data: newCat, error: createError } = await supabase
            .from('categories')
            .insert({
                name: 'Apple',
                slug: 'apple',
                parent_id: parent.id,
                merchant_id: parent.merchant_id, // Inherit merchant
                description: 'Shop the latest Apple iPhones in Nigeria.',
                seo_heading: 'Buy Latest iPhones in Nigeria - iPhone 16, 15 & UK Used',
                seo_description: 'Shop best prices for Apple iPhones in Nigeria. Discover the new iPhone 16 Pro Max, iPhone 15 series, and affordable UK Used iPhone 11, 12 & 13 Pro Max. All phones come with warranty.',
                seo_features: ["12-Month Warranty", "Free Case & Screen Guard", "Pay Small Small", "Nationwide Delivery"],
                seo_faq: [
                    { question: "Are your UK Used iPhones reliable?", answer: "Yes, every UK Used iPhone passes a 30-point quality check and comes with a guarantee." },
                    { question: "What is the price of iPhone 16 Pro Max in Nigeria?", answer: "The iPhone 16 Pro Max price starts from ₦2,400,000 at Ogabassey, depending on storage." },
                    { question: "Can I swap my old iPhone for a new one?", answer: "Yes, we offer swap deals. Visit our Ikeja office for valuation." }
                ]
            })
            .select()
            .single();

        if (createError) {
            console.error("❌ Failed to create category:", createError);
            return;
        }
        categoryId = newCat.id;
        console.log("✅ Created Category ID:", categoryId);
    } else {
        console.log("ℹ️ Category 'Apple' already exists:", categoryId);
    }

    // B. Seed Products
    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} Apple products...`);

    for (const p of PRODUCTS_TO_SEED) {
        const specs = APPLE_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs found for iPhone ${p.model}, skipping content generation.`);
            continue;
        }

        const fullName = `iPhone ${p.model} ${p.ram} ${p.storage} (${p.condition})`;
        const metadata = {
            brand: 'Apple',
            model: p.model,
            ram: p.ram,
            storage: p.storage,
            condition: p.condition,
            sim_type: 'Nano-SIM + eSIM'
        };

        // Determine Pricing based on Tiered Rules
        // Rule: > 450k = 10%, 200k-445k = 15%, < 200k = 20%
        const costPrice = p.price; // Seed list has Base Cost
        let markup = 1.20; // Default < 200k

        if (costPrice > 450000) {
            markup = 1.10;
        } else if (costPrice >= 200000) {
            markup = 1.15;
        }

        let retailPrice = costPrice * markup;
        // Round to nearest 100
        retailPrice = Math.ceil(retailPrice / 100) * 100;

        const description = generateDescription(p.model, fullName, retailPrice, p.condition, metadata, specs);

        // Check/Insert Product
        const { data: existing } = await supabase.from('products').select('id').eq('name', fullName).maybeSingle();

        // DB Constraint requires condition to be 'new' or 'used' (lowercase)
        // Map 'UK Used' -> 'used', 'New' -> 'new'
        const dbCondition = p.condition.toLowerCase() === 'new' ? 'new' : 'used';

        if (existing) {
            console.log(`   ⏩ Skipping existing: ${fullName}`);
            // Optional: Link to category if missing
            await supabase.from('product_categories').upsert({ product_id: existing.id, category_id: categoryId });
        } else {
            console.log(`   ✨ Creating: ${fullName}`);
            console.log(`      Cost: ₦${costPrice}, Markup: ${((markup - 1) * 100).toFixed(0)}%, Retail: ₦${retailPrice}`);

            const { data: newProd, error: insertError } = await supabase
                .from('products')
                .insert({
                    name: fullName,
                    slug: fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                    merchant_id: parent.merchant_id,
                    price: retailPrice,
                    cost_price: costPrice,
                    compare_at_price: Math.floor(retailPrice * 1.05), // Fake 5% discount
                    description: description,
                    metadata: metadata,
                    category: 'Apple', // Flat category field backup
                    status: 'active',
                    stock: 5, // Default stock
                    condition: dbCondition // Fixed: 'new' or 'used'
                })
                .select()
                .single();

            if (insertError) {
                console.error(`   ❌ Failed to insert ${fullName}:`, insertError);
            } else {
                // Link Category
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
                console.log(`   ✅ Created & Linked`);
            }
        }
    }

    console.log("🏁 Apple Seeding Complete!");
}

seedAppleProducts();
