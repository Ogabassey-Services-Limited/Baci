import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// JBL COLOR OPTIONS (Researched)
const JBL_COLORS = {
    'Charge 5': ['Black', 'Blue', 'Red', 'Camo', 'Grey', 'Teal'],
    'Charge 6': ['Black', 'Blue', 'Red', 'Camo', 'White', 'Purple', 'Sand'],
    'Flip 6': ['Black', 'Blue', 'Red', 'Teal', 'Grey', 'White', 'Pink'],
    'Flip 7': ['Black', 'Blue', 'Red', 'Purple', 'Camo'],
    'Go 3': ['Black', 'Blue', 'Red', 'Teal', 'Pink', 'White'],
    'Go 4': ['Black', 'Blue', 'Red', 'Pink', 'Purple'],
    'Clip 5': ['Black', 'Blue', 'Red', 'Camo', 'Pink'],
    'BoomBox 3': ['Black', 'Camo'],
    'BoomBox 4': ['Black', 'Camo'],
    'Xtreme 3': ['Black', 'Blue', 'Camo'],
    'Xtreme 4': ['Black', 'Blue', 'Camo']
};

// Base products with LOWEST cost from user's duplicates
const AUDIO_PRODUCTS = [
    // AirPods
    { name: 'AirPods Max USB-C', cost: 738000, brand: 'Apple', type: 'Headphones' },
    { name: 'AirPods Pro 3', cost: 358000, brand: 'Apple', type: 'Earbuds' },
    { name: 'AirPods Pro 2 USB-C', cost: 269000, brand: 'Apple', type: 'Earbuds' },
    { name: 'AirPods 4', cost: 170000, brand: 'Apple', type: 'Earbuds' },
    { name: 'AirPods 4 with ANC', cost: 237000, brand: 'Apple', type: 'Earbuds' },

    // JBL Headphones
    { name: 'JBL JR310BT Kids Headphones', cost: 69000, brand: 'JBL', type: 'Headphones', model: 'JR310BT' },
    { name: 'JBL Tune 520BT', cost: 49000, brand: 'JBL', type: 'Headphones', model: 'Tune 520BT' },
    { name: 'JBL Tune 530BT', cost: 65000, brand: 'JBL', type: 'Headphones', model: 'Tune 530BT' },
    { name: 'JBL Tune 720BT', cost: 69000, brand: 'JBL', type: 'Headphones', model: 'Tune 720BT' },
    { name: 'JBL Tune 670NC', cost: 94000, brand: 'JBL', type: 'Headphones', model: 'Tune 670NC' },
    { name: 'JBL Tune 770NC', cost: 99000, brand: 'JBL', type: 'Headphones', model: 'Tune 770NC' },
    { name: 'JBL Live 770NC', cost: 165000, brand: 'JBL', type: 'Headphones', model: 'Live 770NC' },

    // JBL Portable Speakers (Note: Using lowest price from duplicates)
    { name: 'JBL Go 3', cost: 50000, brand: 'JBL', type: 'Portable Speaker', model: 'Go 3', colors: JBL_COLORS['Go 3'] },
    { name: 'JBL Go 4', cost: 55000, brand: 'JBL', type: 'Portable Speaker', model: 'Go 4', colors: JBL_COLORS['Go 4'] },
    { name: 'JBL Clip 5', cost: 68000, brand: 'JBL', type: 'Portable Speaker', model: 'Clip 5', colors: JBL_COLORS['Clip 5'] },
    { name: 'JBL Flip 6', cost: 120000, brand: 'JBL', type: 'Portable Speaker', model: 'Flip 6', colors: JBL_COLORS['Flip 6'] },
    { name: 'JBL Flip 7', cost: 135000, brand: 'JBL', type: 'Portable Speaker', model: 'Flip 7', colors: JBL_COLORS['Flip 7'] },
    { name: 'JBL Charge 5', cost: 159000, brand: 'JBL', type: 'Portable Speaker', model: 'Charge 5', colors: JBL_COLORS['Charge 5'], camo_cost: 160000 },
    { name: 'JBL Charge 6', cost: 178000, brand: 'JBL', type: 'Portable Speaker', model: 'Charge 6', colors: JBL_COLORS['Charge 6'] },
    { name: 'JBL Xtreme 3', cost: 340000, brand: 'JBL', type: 'Portable Speaker', model: 'Xtreme 3', colors: JBL_COLORS['Xtreme 3'] },
    { name: 'JBL Xtreme 4', cost: 335000, brand: 'JBL', type: 'Portable Speaker', model: 'Xtreme 4', colors: JBL_COLORS['Xtreme 4'], camo_cost: 338000 },
    { name: 'JBL BoomBox 3', cost: 515000, brand: 'JBL', type: 'Party Speaker', model: 'BoomBox 3', colors: JBL_COLORS['BoomBox 3'] },
    { name: 'JBL BoomBox 4', cost: 650000, brand: 'JBL', type: 'Party Speaker', model: 'BoomBox 4', colors: JBL_COLORS['BoomBox 4'] },

    // JBL Party Speakers
    { name: 'JBL PartyBox 110', cost: 450000, brand: 'JBL', type: 'Party Speaker', model: 'PartyBox 110' },
    { name: 'JBL PartyBox Club 120', cost: 465000, brand: 'JBL', type: 'Party Speaker', model: 'PartyBox Club 120' },
    { name: 'JBL PartyBox 310', cost: 660000, brand: 'JBL', type: 'Party Speaker', model: 'PartyBox 310' },
    { name: 'JBL PartyBox Stage 320', cost: 670000, brand: 'JBL', type: 'Party Speaker', model: 'PartyBox Stage 320' },
    { name: 'JBL PartyBox Encore 2', cost: 567000, brand: 'JBL', type: 'Party Speaker', model: 'PartyBox Encore 2' },

    // Other Brands
    { name: 'Harman Kardon Onyx Studio 8', cost: 265000, brand: 'Harman Kardon', type: 'Portable Speaker', model: 'Onyx Studio 8' },
    { name: 'Harman Kardon Onyx Studio 9', cost: 270000, brand: 'Harman Kardon', type: 'Portable Speaker', model: 'Onyx Studio 9' },
    { name: 'Xiaomi Sound Outdoor 30W Speaker', cost: 79000, brand: 'Xiaomi', type: 'Portable Speaker' },
    { name: 'Anker Soundcore Rave 3S PartyBox', cost: 482000, brand: 'Anker', type: 'Party Speaker', model: 'Rave 3S' },
    { name: 'SkullCandy Barrel BoomBox', cost: 435000, brand: 'SkullCandy', type: 'Party Speaker' },
    { name: 'Green Lion Partylife 300', cost: 185000, brand: 'Green Lion', type: 'Party Speaker' },
    { name: 'Green Lion Boombeats', cost: 98000, brand: 'Green Lion', type: 'Portable Speaker' },
    { name: 'Green Lion Pristone Pro', cost: 52000, brand: 'Green Lion', type: 'Portable Speaker' },
    { name: 'Green Lion Beam Pro', cost: 265000, brand: 'Green Lion', type: 'Portable Speaker' },

    // PS5 Products
    { name: 'PlayStation 5 Slim Disc 1TB', cost: 756000, brand: 'Sony', type: 'Gaming Console' },
    { name: 'PlayStation 5 Slim Digital 1TB (Euro)', cost: 687000, brand: 'Sony', type: 'Gaming Console' },
    { name: 'PlayStation 5 Pro 2TB', cost: 1148000, brand: 'Sony', type: 'Gaming Console' },
    { name: 'PS5 Slim Carrying Bag', cost: 56000, brand: 'Sony', type: 'Gaming Accessory' },
    { name: 'PlayStation 5 DualSense Controller', cost: 92000, brand: 'Sony', type: 'Gaming Accessory', colors: ['White', 'Camo'], camo_cost: 93000 },
    { name: 'PlayStation 4 DualShock Controller', cost: 15000, brand: 'Sony', type: 'Gaming Accessory' },
];

function generateSlug(name: string): string {
    return name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function generateDescription(product: any, sellingPrice: number) {
    const priceStr = `₦${sellingPrice.toLocaleString()}`;

    if (product.brand === 'Apple') {
        return `# ${product.name}

Experience premium audio with the **${product.name}**. Available now at Ogabassey for **${priceStr}**.

## Key Features

${product.name.includes('AirPods Max') ? '- H2 chip for superior audio\n- Active Noise Cancellation (ANC)\n- Spatial Audio with dynamic head tracking\n- Up to 20 hours of battery life\n- USB-C charging' : ''}
${product.name.includes('AirPods Pro 3') ? '- Next-gen H2 chip\n- Advanced Active Noise Cancellation\n- Adaptive Audio & Transparency Mode\n- Personalized Spatial Audio\n- Up to 6 hours listening time (30 hours with case)' : ''}
${product.name.includes('AirPods Pro 2') ? '- H2 chip for 2x noise cancellation\n- Adaptive Audio & Transparency Mode\n- Personalized Spatial Audio\n- USB-C charging case with speaker\n- Up to 6 hours (30 hours with case)\n- Hearing health features (iOS 18+)' : ''}
${product.name.includes('AirPods 4') ? `- H2 chip\n- Improved comfort & fit\n- Spatial Audio\n${product.name.includes('ANC') ? '- Active Noise Cancellation\n- Transparency Mode\n' : ''}- IP54 dust & water resistant\n- Up to ${product.name.includes('ANC') ? '4 hours with ANC' : '5 hours'} (30 hours with case)` : ''}

## Why Buy from Ogabassey?

- ✅ **100% Genuine Apple Products**
- ✅ **Brand New with Warranty**
- ✅ **Fast Nationwide Delivery**
- ✅ **Expert Customer Support**
`.trim();
    }

    if (product.brand === 'JBL') {
        return `# ${product.name}

Get the legendary JBL sound with the **${product.name}**. Now available at Ogabassey for **${priceStr}**.

## Specifications

${product.type === 'Headphones' ? '- Wireless Bluetooth connectivity\n- Premium sound quality\n' + (product.model?.includes('NC') ? '- Active Noise Cancellation\n' : '') + '- Long battery life\n- Foldable design' : ''}
${product.type === 'Portable Speaker' || product.type === 'Party Speaker' ? `- JBL Pro Sound\n- IP67 waterproof (portable models)\n- PartyBoost/Auracast support\n- USB-C charging\n- Built-in powerbank (select models)\n${product.type === 'Party Speaker' ? '- Dynamic light show\n- Karaoke features (select models)\n- TWS (True Wireless Stereo)' : ''}` : ''}

${product.colors ? `## Available Colors\n${product.colors.join(', ')}` : ''}

## Why JBL?

- Legendary sound quality since 1946
- Durable, waterproof designs
- Perfect for outdoor adventures

## Why Buy from Ogabassey?

- ✅ **Genuine JBL Products**
- ✅ **Competitive Prices**
- ✅ **Warranty Included**
- ✅ **Fast Delivery Nationwide**
`.trim();
    }

    // Generic description for other brands
    return `# ${product.name}

${product.brand} ${product.type} available at Ogabassey for **${priceStr}**.

## Product Details

| Feature | Details |
|---------|---------|
| **Brand** | ${product.brand} |
| **Type** | ${product.type} |
${product.model ? `| **Model** | ${product.model} |` : ''}
| **Condition** | Brand New |

## Why Buy from Ogabassey?

- ✅ **Genuine Products**
- ✅ **Warranty Included**
- ✅ **Fast Delivery**
- ✅ **Best Prices in Nigeria**
`.trim();
}

async function seedAudioProducts() {
    console.log("🚀 Starting Audio Products Import...");

    // 1. Get Merchant
    const { data: merchant } = await supabase.from('merchants').select('id').eq('slug', 'ogabassey').single();
    if (!merchant) throw new Error("Ogabassey merchant not found");
    const merchantId = merchant.id;

    // 2. Setup Categories
    let { data: audioCat } = await supabase.from('categories').select('id').eq('name', 'Audio').single();
    if (!audioCat) {
        const { data: newAudio } = await supabase.from('categories').insert({
            name: 'Audio',
            slug: 'audio',
            merchant_id: merchantId
        }).select().single();
        audioCat = newAudio;
        console.log("✅ Created 'Audio' category");
    }

    // Subcategories
    const subcats = ['Headphones', 'Earbuds', 'Portable Speakers', 'Party Speakers'];
    const catMap: Record<string, string> = {};

    for (const catName of subcats) {
        let { data: cat } = await supabase.from('categories').select('id').eq('name', catName).single();
        if (!cat) {
            const { data: newCat } = await supabase.from('categories').insert({
                name: catName,
                slug: catName.toLowerCase().replace(/\s+/g, '-'),
                parent_id: audioCat.id,
                merchant_id: merchantId
            }).select().single();
            cat = newCat;
            console.log(`✅ Created '${catName}' subcategory`);
        }
        catMap[catName] = cat.id;
        if (catName === 'Portable Speakers') catMap['Portable Speaker'] = cat.id;
        if (catName === 'Party Speakers') catMap['Party Speaker'] = cat.id;
    }

    // Gaming category for PS5
    let { data: gamingCat } = await supabase.from('categories').select('id').eq('name', 'Gaming').single();
    if (gamingCat) {
        catMap['Gaming Console'] = gamingCat.id;
        catMap['Gaming Accessory'] = gamingCat.id;
    }

    // 3. Import Products
    let count = 0;
    for (const product of AUDIO_PRODUCTS) {
        const sellingPrice = Math.ceil(product.cost * 1.2);
        const slug = generateSlug(product.name);
        const externalId = `audio-${slug}`;
        const categoryId = catMap[product.type] || audioCat.id;

        const structuredSpecs = [
            { label: 'Brand', value: product.brand },
            { label: 'Type', value: product.type },
            ...(product.model ? [{ label: 'Model', value: product.model }] : [])
        ];

        const payload = {
            name: product.name,
            slug: slug,
            description: generateDescription(product, sellingPrice),
            price: sellingPrice,
            cost_price: product.cost,
            category: categoryId,
            merchant_id: merchantId,
            status: 'active',
            condition: 'new',
            condition_detail: 'Brand New',
            external_id: externalId,
            external_source: 'manual_import_audio',
            specifications: [{ category: 'Specs', items: structuredSpecs }],
            metadata: {
                brand: product.brand,
                type: product.type,
                model: product.model,
                specs: structuredSpecs,
                search_tags: [product.brand, product.type, product.model || '', product.name].filter(Boolean)
            },
            stock: 10,
            manage_stock: true
        };

        const { data: insertedProduct, error } = await supabase.from('products')
            .upsert(payload, { onConflict: 'external_id' })
            .select()
            .single();

        if (error) {
            console.error(`❌ Failed ${product.name}:`, error.message);
            continue;
        }

        console.log(`✅ Upserted ${product.name}`);
        count++;

        // Add color variants if product has them
        if (product.colors && insertedProduct) {
            for (const color of product.colors) {
                const variantCost = (color === 'Camo' && product.camo_cost) ? product.camo_cost : product.cost;
                const variantPrice = Math.ceil(variantCost * 1.2);
                const sku = `${slug}-${color.toLowerCase()}`.replace(/\s+/g, '-');

                const { error: variantError } = await supabase.from('product_variants').upsert({
                    product_id: insertedProduct.id,
                    name: color,
                    sku: sku,
                    price: variantPrice,
                    stock: 5,
                    metadata: {
                        color: color,
                        color_hex: color === 'Black' ? '#000000' :
                            color === 'White' ? '#FFFFFF' :
                                color === 'Blue' ? '#0066CC' :
                                    color === 'Red' ? '#CC0000' :
                                        color === 'Camo' ? '#8B7355' :
                                            color === 'Teal' ? '#008080' :
                                                color === 'Purple' ? '#800080' :
                                                    color === 'Sand' ? '#C2B280' : '#808080'
                    }
                }, { onConflict: 'product_id,sku' });

                if (variantError) {
                    console.error(`  ⚠️  Variant ${color} failed:`, variantError.message);
                } else {
                    console.log(`  ✅ Added variant: ${color}`);
                }
            }
        }
    }

    console.log(`\n🎉 Complete! Imported ${count} audio products.`);
}

seedAudioProducts().catch(console.error);
