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

//================================================================
// PRICE DATA (From User)
//================================================================

const TV_DATA = [
    { name: '32" SAMSUNG TIZEN OS SMART TV', cost: 180000, brand: 'Samsung', size: 32, tech: 'Tizen OS', resolution: 'HD' },
    { name: '32" SAMSUNG TIZEN OS SMART TV WITH HDR X APPLE AIRPLAY', cost: 200000, brand: 'Samsung', size: 32, tech: 'Tizen OS', resolution: 'HD', features: ['HDR', 'Apple AirPlay'] },

    { name: '40" SAMSUNG TIZEN OS SMART TV', cost: 250000, brand: 'Samsung', size: 40, tech: 'Tizen OS', resolution: 'Full HD' },
    { name: '40" SAMSUNG UHD 4K HDR 10 SMART TV', cost: 280000, brand: 'Samsung', size: 40, tech: 'UHD', resolution: '4K', features: ['HDR10'] },

    { name: '43" SAMSUNG UHD 4K HDR 10 SMART TV', cost: 300000, brand: 'Samsung', size: 43, tech: 'UHD', resolution: '4K', features: ['HDR10'] },
    { name: '43" SAMSUNG CRYSTAL UHD 4K HDR 10 SMART TV', cost: 350000, brand: 'Samsung', size: 43, tech: 'Crystal UHD', resolution: '4K', features: ['HDR10'] },
    { name: '43" SAMSUNG QLED QHDR SMART TV', cost: 400000, brand: 'Samsung', size: 43, tech: 'QLED', resolution: '4K', features: ['QHDR'] },
    { name: '43" LG UHD 4K HDR 10 SMART TV', cost: 300000, brand: 'LG', size: 43, tech: 'UHD', resolution: '4K', features: ['HDR10'] },
    { name: '43" LG PREMIUM UHD 4K HDR 10', cost: 350000, brand: 'LG', size: 43, tech: 'Premium UHD', resolution: '4K', features: ['HDR10'] },

    { name: '50" SAMSUNG TIZEN OS SMART TV', cost: 305000, brand: 'Samsung', size: 50, tech: 'Tizen OS', resolution: 'Full HD' },
    { name: '49/50" SAMSUNG UHD 4K HDR 10 SMART TV', cost: 450000, brand: 'Samsung', size: 50, tech: 'UHD', resolution: '4K', features: ['HDR10'] },
    { name: '49" SAMSUNG CURVED UHD 4K HDR 10 SMART TV', cost: 480000, brand: 'Samsung', size: 49, tech: 'Curved UHD', resolution: '4K', features: ['HDR10', 'Curved Display'] },
    { name: '50" SAMSUNG CRYSTAL UHD 4K HDR 10 SMART TV WITH APPLE AIRPLAY', cost: 500000, brand: 'Samsung', size: 50, tech: 'Crystal UHD', resolution: '4K', features: ['HDR10', 'Apple AirPlay'] },
    { name: '49" SAMSUNG QLED QHDR SMART TV', cost: 600000, brand: 'Samsung', size: 49, tech: 'QLED', resolution: '4K', features: ['QHDR'] },
    { name: '50" SAMSUNG QLED QHDR SMART TV', cost: 650000, brand: 'Samsung', size: 50, tech: 'QLED', resolution: '4K', features: ['QHDR'] },
    { name: '50" LG UHD 4K HDR 10 SMART TV', cost: 450000, brand: 'LG', size: 50, tech: 'UHD', resolution: '4K', features: ['HDR10'] },
    { name: '49/50" LG NANO CELL DISPLAY SMART TV WITH APPLE AIRPLAY', cost: 500000, brand: 'LG', size: 50, tech: 'NanoCell', resolution: '4K', features: ['Apple AirPlay'] },

    { name: '55" SAMSUNG UHD 4K HDR 10 SMART TV', cost: 600000, brand: 'Samsung', size: 55, tech: 'UHD', resolution: '4K', features: ['HDR10'] },
    { name: '55" SAMSUNG CURVED UHD 4K HDR 10 SMART TV', cost: 650000, brand: 'Samsung', size: 55, tech: 'Curved UHD', resolution: '4K', features: ['HDR10', 'Curved Display'] },
    { name: '55" SAMSUNG QLED QHDR SMART TV', cost: 750000, brand: 'Samsung', size: 55, tech: 'QLED', resolution: '4K', features: ['QHDR'] },
    { name: '55" SAMSUNG NEO QLED QHDR SMART TV', cost: 1100000, brand: 'Samsung', size: 55, tech: 'Neo QLED', resolution: '4K', features: ['QHDR', 'Mini-LED'] },
    { name: '55" SAMSUNG OLED SMART TV', cost: 1500000, brand: 'Samsung', size: 55, tech: 'OLED', resolution: '4K' },
    { name: '55" LG UHD 4K HDR 10 SMART TV', cost: 600000, brand: 'LG', size: 55, tech: 'UHD', resolution: '4K', features: ['HDR10'] },
    { name: '55" LG NANO CELL 4K DISPLAY SMART TV', cost: 650000, brand: 'LG', size: 55, tech: 'NanoCell', resolution: '4K' },
    { name: '55" LG NANO CELL 8K DISPLAY SMART TV', cost: 800000, brand: 'LG', size: 55, tech: 'NanoCell', resolution: '8K' },
    { name: '55" LG QNED DISPLAY SMART TV', cost: 800000, brand: 'LG', size: 55, tech: 'QNED', resolution: '4K' },
    { name: '55" LG OLED SMART TV', cost: 1100000, brand: 'LG', size: 55, tech: 'OLED', resolution: '4K' },

    { name: '58" SAMSUNG UHD 4K HDR 10 SMART TV', cost: 700000, brand: 'Samsung', size: 58, tech: 'UHD', resolution: '4K', features: ['HDR10'] },

    { name: '60" SAMSUNG UHD 4K HDR 10 SMART TV', cost: 750000, brand: 'Samsung', size: 60, tech: 'UHD', resolution: '4K', features: ['HDR10'] },
    { name: '60" LG UHD 4K HDR 10 SMART TV', cost: 700000, brand: 'LG', size: 60, tech: 'UHD', resolution: '4K', features: ['HDR10'] },

    { name: '65" SAMSUNG UHD 4K HDR 10 SMART TV', cost: 850000, brand: 'Samsung', size: 65, tech: 'UHD', resolution: '4K', features: ['HDR10'] },
    { name: '65" SAMSUNG CURVED CRYSTAL UHD 4K HDR 10 SMART TV', cost: 1000000, brand: 'Samsung', size: 65, tech: 'Curved Crystal UHD', resolution: '4K', features: ['HDR10', 'Curved Display'] },
    { name: '65" SAMSUNG CRYSTAL UHD 4K HDR 10 SMART TV', cost: 900000, brand: 'Samsung', size: 65, tech: 'Crystal UHD', resolution: '4K', features: ['HDR10'] },
    { name: '65" SAMSUNG QLED QHDR SMART TV', cost: 1200000, brand: 'Samsung', size: 65, tech: 'QLED', resolution: '4K', features: ['QHDR'] },
    { name: '65" SAMSUNG NEO QLED QHDR SMART TV', cost: 1800000, brand: 'Samsung', size: 65, tech: 'Neo QLED', resolution: '4K', features: ['QHDR', 'Mini-LED'] },
    { name: '65" SAMSUNG OLED SMART TV', cost: 2700000, brand: 'Samsung', size: 65, tech: 'OLED', resolution: '4K' },
    { name: '65" LG REAL UHD 4K HDR 10 SMART TV', cost: 800000, brand: 'LG', size: 65, tech: 'Real UHD', resolution: '4K', features: ['HDR10'] },
    { name: '65" LG NANO CELL DISPLAY SMART TV', cost: 900000, brand: 'LG', size: 65, tech: 'NanoCell', resolution: '4K' },
    { name: '65" LG QNED DISPLAY SMART TV', cost: 1200000, brand: 'LG', size: 65, tech: 'QNED', resolution: '4K' },
    { name: '65" LG OLED SMART TV', cost: 1800000, brand: 'LG', size: 65, tech: 'OLED', resolution: '4K' },

    { name: '75" SAMSUNG CRYSTAL UHD 4K HDR 10 SMART TV', cost: 1400000, brand: 'Samsung', size: 75, tech: 'Crystal UHD', resolution: '4K', features: ['HDR10'] },
    { name: '75" SAMSUNG QLED QHDR SMART TV', cost: 2000000, brand: 'Samsung', size: 75, tech: 'QLED', resolution: '4K', features: ['QHDR'] },
    { name: '75" SAMSUNG NEO QLED QHDR SMART TV', cost: 3000000, brand: 'Samsung', size: 75, tech: 'Neo QLED', resolution: '4K', features: ['QHDR', 'Mini-LED'] },
    { name: '75" LG UHD 4K HDR 10 SMART TV', cost: 1300000, brand: 'LG', size: 75, tech: 'UHD', resolution: '4K', features: ['HDR10'] },

    { name: '77" LG OLED DISPLAY SMART TV', cost: 4000000, brand: 'LG', size: 77, tech: 'OLED', resolution: '4K' },
    { name: '77" SAMSUNG OLED DISPLAY SMART TV', cost: 5000000, brand: 'Samsung', size: 77, tech: 'OLED', resolution: '4K' },
    { name: '83" SAMSUNG OLED DISPLAY SMART TV', cost: 8000000, brand: 'Samsung', size: 83, tech: 'OLED', resolution: '4K' },
    { name: '85" SAMSUNG QLED QHDR SMART TV', cost: 3000000, brand: 'Samsung', size: 85, tech: 'QLED', resolution: '4K', features: ['QHDR'] },
    { name: '85" SAMSUNG NEO QLED SMART TV', cost: 4500000, brand: 'Samsung', size: 85, tech: 'Neo QLED', resolution: '4K', features: ['Mini-LED'] },
];

const SOUNDBAR_DATA = [
    { name: 'SONY SOLO SOUND BAR HT-S100F', cost: 180000, brand: 'Sony', model: 'HT-S100F', type: 'Solo Soundbar' },
    { name: 'SONY SOUND BAR HT-G700', cost: 450000, brand: 'Sony', model: 'HT-G700', type: 'Soundbar' },
    { name: 'SONY SOUND BAR HT-S400', cost: 400000, brand: 'Sony', model: 'HT-S400', type: 'Soundbar' },
    { name: 'SONY SOUND BAR HT-A5000', cost: 1000000, brand: 'Sony', model: 'HT-A5000', type: 'Premium Soundbar' },

    { name: 'LG SOUND BAR SK5', cost: 300000, brand: 'LG', model: 'SK5', type: 'Soundbar' },
    { name: 'LG SOUND BAR SP6', cost: 400000, brand: 'LG', model: 'SP6', type: 'Soundbar' },
    { name: 'LG SOUND BAR SP9', cost: 450000, brand: 'LG', model: 'SP9', type: 'Soundbar' },

    { name: 'SAMSUNG SOUND BAR HW-T/A450', cost: 300000, brand: 'Samsung', model: 'HW-T/A450', type: 'Soundbar' },
    { name: 'SAMSUNG SOUND BAR HW-T/C450 (Brand New)', cost: 350000, brand: 'Samsung', model: 'HW-T/C450', type: 'Soundbar', condition: 'new' },
    { name: 'SAMSUNG SOUND BAR HW-K450', cost: 350000, brand: 'Samsung', model: 'HW-K450', type: 'Soundbar' },
    { name: 'SAMSUNG SOUND BAR HW-Q800A', cost: 600000, brand: 'Samsung', model: 'HW-Q800A', type: 'Premium Soundbar' },
    { name: 'SAMSUNG SOUND BAR HW-Q800B', cost: 650000, brand: 'Samsung', model: 'HW-Q800B', type: 'Premium Soundbar' },
    { name: 'SAMSUNG SOUND BAR HW-Q910C', cost: 950000, brand: 'Samsung', model: 'HW-Q910C', type: 'Premium Soundbar' },
];

//================================================================
// DISPLAY TECH SPECS (Researched)
//================================================================

const DISPLAY_TECH_INFO: Record<string, any> = {
    "QLED": {
        name: "QLED (Quantum Dot LED)",
        desc: "Samsung's Quantum Dot technology delivers stunning colors and brightness. Quantum dots enhance color accuracy and produce vibrant, true-to-life images perfect for bright rooms.",
        features: "Quantum Dot color, High luminance, Zero burn-in risk",
        bestFor: "Bright rooms, Gaming, Sports"
    },
    "Neo QLED": {
        name: "Neo QLED (Mini-LED)",
        desc: "Samsung's most advanced LED technology featuring Mini-LED backlighting with thousands of tiny LEDs for precise light control. Delivers exceptional contrast and deep blacks while maintaining QLED's vibrant colors.",
        features: "Mini-LED backlighting, Deep blacks, 4-5x brighter than OLED, No burn-in",
        bestFor: "Premium viewing, HDR content, Mixed lighting"
    },
    "OLED": {
        name: "OLED (Self-Emissive Display)",
        desc: "The pinnacle of display technology with self-illuminating pixels that can turn completely off for perfect blacks and infinite contrast. Each pixel produces its own light, delivering stunning picture quality.",
        features: "Perfect blacks, Infinite contrast, Ultra-thin design, Wide viewing angles",
        bestFor: "Movies, Dark rooms, Premium viewing"
    },
    "Crystal UHD": {
        name: "Crystal UHD",
        desc: "Samsung's refined 4K LED technology delivering crisp UHD resolution with enhanced color and HDR support. A solid choice for everyday viewing.",
        features: "4K UHD resolution, HDR10 support, Good brightness",
        bestFor: "General viewing, Value seekers"
    },
    "UHD": {
        name: "4K UHD",
        desc: "Ultra High Definition display with 4 times the resolution of Full HD. Delivers sharp, detailed images for an immersive viewing experience.",
        features: "4K resolution (3840x2160), HDR support, Smart features",
        bestFor: "Movies, Streaming, General use"
    },
    "NanoCell": {
        name: "LG NanoCell",
        desc: "LG's nano particle technology filters out dull colors for purer, more accurate hues. Delivers vibrant colors and wide viewing angles.",
        features: "Nano particle filter, Purer colors, Wide viewing angles",
        bestFor: "Large viewing spaces, Wide seating"
    },
    "QNED": {
        name: "LG QNED (Quantum NanoCell + Mini-LED)",
        desc: "LG's premium LED technology combining Quantum Dots, NanoCell filtering, and Mini-LED backlighting for superior brightness, contrast, and color accuracy.",
        features: "Quantum Dots + NanoCell + Mini-LED, Superior brightness, Deep blacks",
        bestFor: "Bright rooms, HDR content, Premium viewing"
    },
    "Tizen OS": {
        name: "Samsung Tizen Smart TV",
        desc: "Samsung's intelligent Tizen operating system with AI-powered personalization, SmartThings integration, and Gaming Hub. Enjoy seamless streaming and smart home control.",
        features: "AI personalization, SmartThings Hub, Gaming Hub, 7-year OS updates",
        bestFor: "Smart home users, Gamers, Streaming"
    }
};

//================================================================
// HELPERS
//================================================================

function getTechInfo(tech: string) {
    // Try exact match first
    if (DISPLAY_TECH_INFO[tech]) return DISPLAY_TECH_INFO[tech];

    // Fallback matching
    const t = tech.toUpperCase();
    if (t.includes('NEO QLED')) return DISPLAY_TECH_INFO['Neo QLED'];
    if (t.includes('QLED')) return DISPLAY_TECH_INFO['QLED'];
    if (t.includes('OLED')) return DISPLAY_TECH_INFO['OLED'];
    if (t.includes('CRYSTAL')) return DISPLAY_TECH_INFO['Crystal UHD'];
    if (t.includes('QNED')) return DISPLAY_TECH_INFO['QNED'];
    if (t.includes('NANO')) return DISPLAY_TECH_INFO['NanoCell'];
    if (t.includes('TIZEN')) return DISPLAY_TECH_INFO['Tizen OS'];

    return DISPLAY_TECH_INFO['UHD']; // Default
}

function generateSlug(name: string): string {
    return name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function generateTVDescription(tv: any, techInfo: any, price: number) {
    const priceStr = `₦${price.toLocaleString()}`;
    const features = tv.features ? tv.features.join(', ') : techInfo.features;

    return `# ${tv.name}

Get the **${tv.size}" ${tv.brand} ${tv.tech} Smart TV** at the best price in Nigeria from Ogabassey. Available now for **${priceStr}**.

## ${techInfo.name}

${techInfo.desc}

### Key Specifications

| Feature | Details |
|---------|---------|
| **Screen Size** | ${tv.size}\" (${techInfo.bestFor}) |
| **Resolution** | ${tv.resolution} |
| **Display Technology** | ${techInfo.name} |
| **Key Features** | ${features} |
| **Smart Platform** | ${tv.brand === 'Samsung' ? 'Tizen OS (7-year updates)' : 'webOS'} |
| **Condition** | ${tv.size >= 75 ? 'New Open Box' : 'Premium Used'} |

## Why This TV?

**${techInfo.bestFor}** - ${techInfo.desc.substring(0, 100)}...

## Why Buy from Ogabassey?

- ✅ **Best Prices:** Competitive pricing on premium TVs
- ✅ **Quality Assured:** ${tv.size >= 75 ? 'Open box inspection completed' : 'Tested & certified 100% functional'}
- ✅ **Fast Delivery:** Nationwide shipping across Nigeria
- ✅ **Expert Support:** Dedicated customer service team
`.trim();
}

function generateSoundbarDescription(sb: any, price: number) {
    const priceStr = `₦${price.toLocaleString()}`;

    return `# ${sb.brand} ${sb.model} Soundbar

Upgrade your audio experience with the **${sb.brand} ${sb.model}** soundbar. Available at Ogabassey for **${priceStr}**.

## Product Details

| Feature | Details |
|---------|---------|
| **Brand** | ${sb.brand} |
| **Model** | ${sb.model} |
| **Type** | ${sb.type} |
| **Condition** | ${sb.condition === 'new' ? 'Brand New' : 'Premium Used'} |

## Features

${sb.brand === 'Sony' ? '- Dolby Atmos support (select models)\n- S-Force PRO Front Surround\n- Wireless connectivity' : ''}
${sb.brand === 'LG' ? '- AI Sound Pro\n- Meridian Audio Technology\n- Wireless subwoofer' : ''}
${sb.brand === 'Samsung' ? '- Q-Symphony (compatible with Samsung TVs)\n- Adaptive Sound\n- Wireless Dolby Atmos' : ''}

## Why Buy from Ogabassey?

- ✅ **Genuine Products:** 100% authentic ${sb.brand} soundbars
- ✅ **Warranty:** ${sb.condition === 'new' ? '1-year' : '90-day'} warranty included
- ✅ **Expert Setup:** Installation guidance available
- ✅ **Nationwide Delivery:** Fast shipping across Nigeria
`.trim();
}

//================================================================
// MAIN FUNCTION
//================================================================

async function seedTVsAndSoundbars() {
    console.log("🚀 Starting Smart TV & Soundbar Import...");

    // 1. Get Merchant
    const { data: merchant } = await supabase.from('merchants').select('id').eq('slug', 'ogabassey').single();
    if (!merchant) throw new Error("Ogabassey merchant not found");
    const merchantId = merchant.id;

    // 2. Setup Categories
    // Ensure 'Smart TVs' parent
    let { data: tvCat } = await supabase.from('categories').select('id').eq('name', 'Smart TVs').single();
    if (!tvCat) {
        const { data: newTV } = await supabase.from('categories').insert({
            name: 'Smart TVs',
            slug: 'smart-tvs',
            merchant_id: merchantId
        }).select().single();
        tvCat = newTV;
        console.log("✅ Created 'Smart TVs' category");
    }

    // Samsung TVs subcategory
    let { data: samsungCat } = await supabase.from('categories').select('id').eq('name', 'Samsung TVs').single();
    if (!samsungCat) {
        const { data: newSamsung } = await supabase.from('categories').insert({
            name: 'Samsung TVs',
            slug: 'samsung-tvs',
            parent_id: tvCat.id,
            merchant_id: merchantId
        }).select().single();
        samsungCat = newSamsung;
        console.log("✅ Created 'Samsung TVs' subcategory");
    }

    // LG TVs subcategory
    let { data: lgCat } = await supabase.from('categories').select('id').eq('name', 'LG TVs').single();
    if (!lgCat) {
        const { data: newLG } = await supabase.from('categories').insert({
            name: 'LG TVs',
            slug: 'lg-tvs',
            parent_id: tvCat.id,
            merchant_id: merchantId
        }).select().single();
        lgCat = newLG;
        console.log("✅ Created 'LG TVs' subcategory");
    }

    // Audio parent & Soundbars subcategory
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

    let { data: soundbarCat } = await supabase.from('categories').select('id').eq('name', 'Soundbars').single();
    if (!soundbarCat) {
        const { data: newSB } = await supabase.from('categories').insert({
            name: 'Soundbars',
            slug: 'soundbars',
            parent_id: audioCat.id,
            merchant_id: merchantId
        }).select().single();
        soundbarCat = newSB;
        console.log("✅ Created 'Soundbars' subcategory");
    }

    // 3. Import TVs
    let tvCount = 0;
    for (const tv of TV_DATA) {
        const techInfo = getTechInfo(tv.tech);
        const sellingPrice = Math.ceil(tv.cost * 1.2);
        const slug = generateSlug(tv.name);
        const externalId = `tv-${slug}`;
        const condition = tv.size >= 75 ? 'new' : 'used';
        const conditionDetail = tv.size >= 75 ? 'New Open Box' : 'Premium Used';

        const structuredSpecs = [
            { label: 'Screen Size', value: `${tv.size}"` },
            { label: 'Resolution', value: tv.resolution },
            { label: 'Display Technology', value: tv.tech },
            { label: 'Smart Platform', value: tv.brand === 'Samsung' ? 'Tizen OS' : 'webOS' },
            ...(tv.features || []).map((f: string) => ({ label: 'Feature', value: f }))
        ];

        const payload = {
            name: tv.name,
            slug: slug,
            description: generateTVDescription(tv, techInfo, sellingPrice),
            price: sellingPrice,
            cost_price: tv.cost,
            category: tv.brand === 'Samsung' ? samsungCat.id : lgCat.id,
            merchant_id: merchantId,
            status: 'active',
            condition: condition,
            condition_detail: conditionDetail,
            external_id: externalId,
            external_source: 'manual_import_tvs',
            specifications: [{ category: 'Display Specs', items: structuredSpecs }],
            metadata: {
                brand: tv.brand,
                screen_size: tv.size,
                resolution: tv.resolution,
                display_tech: tv.tech,
                specs: structuredSpecs,
                search_tags: [tv.brand, tv.tech, `${tv.size} inch`, tv.resolution, 'Smart TV']
            },
            stock: 3,
            manage_stock: true
        };

        const { error } = await supabase.from('products').upsert(payload, { onConflict: 'external_id' });

        if (error) {
            console.error(`❌ Failed ${tv.name}:`, error.message);
        } else {
            console.log("✅ Upserted", tv.name);
            tvCount++;
        }
    }

    // 4. Import Soundbars
    let sbCount = 0;
    for (const sb of SOUNDBAR_DATA) {
        const sellingPrice = Math.ceil(sb.cost * 1.2);
        const slug = generateSlug(sb.name);
        const externalId = `soundbar-${slug}`;
        const condition = sb.condition === 'new' ? 'new' : 'used';
        const conditionDetail = sb.condition === 'new' ? 'Brand New' : 'Premium Used';

        const structuredSpecs = [
            { label: 'Brand', value: sb.brand },
            { label: 'Model', value: sb.model },
            { label: 'Type', value: sb.type }
        ];

        const payload = {
            name: sb.name,
            slug: slug,
            description: generateSoundbarDescription(sb, sellingPrice),
            price: sellingPrice,
            cost_price: sb.cost,
            category: soundbarCat.id,
            merchant_id: merchantId,
            status: 'active',
            condition: condition,
            condition_detail: conditionDetail,
            external_id: externalId,
            external_source: 'manual_import_soundbars',
            specifications: [{ category: 'Audio Specs', items: structuredSpecs }],
            metadata: {
                brand: sb.brand,
                model: sb.model,
                type: sb.type,
                specs: structuredSpecs,
                search_tags: [sb.brand, sb.model, 'Soundbar', 'Audio', 'Home Theater']
            },
            stock: 2,
            manage_stock: true
        };

        const { error } = await supabase.from('products').upsert(payload, { onConflict: 'external_id' });

        if (error) {
            console.error(`❌ Failed ${sb.name}:`, error.message);
        } else {
            console.log("✅ Upserted", sb.name);
            sbCount++;
        }
    }

    console.log("\n🎉 Complete! Imported", tvCount, "TVs and", sbCount, "Soundbars.");
}

seedTVsAndSoundbars().catch(console.error);
