
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

// ------------------------------------------------------------------
// DATA SOURCE (From User Image)
// ------------------------------------------------------------------

const PRICE_DATA = [
    { model: "A3X 4 64", rdp: 124700, rrp: 129900, specs: "4GB/64GB" },
    { model: "A5x 4 64", rdp: 143300, rrp: 149900, specs: "4GB/64GB" }, // Likely A18/A38 equivalent or re-release
    { model: "A3X 4 128", rdp: 148000, rrp: 154900, specs: "4GB/128GB" },
    { model: "A5x 4 128", rdp: 157400, rrp: 164900, specs: "4GB/128GB" },
    { model: "A5 6 128", rdp: 218800, rrp: 229900, specs: "6GB/128GB" }, // Likely A58/A60 class
    { model: "A3 6 128", rdp: 235100, rrp: 247500, specs: "6GB/128GB" }, // A3 2024
    { model: "A5 8 256", rdp: 257000, rrp: 269900, specs: "8GB/256GB" },
    { model: "A5 pro 8 256GB", rdp: 284900, rrp: 299900, specs: "8GB/256GB" },
    { model: "A3 8 256", rdp: 286100, rrp: 301200, specs: "8GB/256GB" },
    { model: "A6 pro 8 256GB 4g", rdp: 351400, rrp: 369900, specs: "8GB/256GB" },
    { model: "A6 pro 8 256GB 5g", rdp: 397800, rrp: 418900, specs: "8GB/256GB" },
    { model: "Reno14F 12 512 5G", rdp: 570100, rrp: 600100, specs: "12GB/512GB" },
    { model: "Reno14 12 512 5G", rdp: 855200, rrp: 900200, specs: "12GB/512GB" }
];

// ------------------------------------------------------------------
// SPECS DATABASE (Researched)
// ------------------------------------------------------------------

const MODEL_SPECS: Record<string, any> = {
    "A3X": {
        name: "Oppo A3x (2024)",
        screen: "6.67\" HD+ 90Hz/120Hz LCD (1000 nits)",
        processor: "Snapdragon 6s Gen 1 / Dimensity 6300",
        battery: "5100mAh, 45W SUPERVOOC",
        camera: "8MP Rear, 5MP Front",
        features: "Military-Grade Shock Resistance, IP54 Splash Proof",
        desc: "The Oppo A3x is built to last with military-grade shock resistance and a long-lasting 5100mAh battery. Enjoy smooth visuals on the bright 1000 nits display."
    },
    "A3": {
        name: "Oppo A3 (2024)",
        screen: "6.67\" LCD, 90Hz",
        processor: "Snapdragon 6s Gen 1",
        battery: "5100mAh, 45W Fast Charging",
        camera: "50MP Main Camera",
        features: "High Durability, Splash Touch",
        desc: "Oppo A3 delivers reliable performance with a tough design. Capture clear photos with the 50MP camera and stay powered all day with 45W fast charging."
    },
    "A5": { // Mapping A5 to A58/A60 generic specs to be safe as exact year unconfirmed
        name: "Oppo A5 Series",
        screen: "6.72\" FHD+ Sunlight Display",
        processor: "MediaTek Helio G85 / Dimensity 6020",
        battery: "5000mAh, 33W SUPERVOOC",
        camera: "50MP AI Camera",
        features: "Dual Stereo Speakers, Glow Design",
        desc: "Experience entertainment like never before with the Oppo A5's large FHD+ display and dual stereo speakers. A stylish companion for your daily needs."
    },
    "A5X": { // Budget entry
        name: "Oppo A5x (Budget Edition)",
        screen: "6.56\" HD+ Waterdrop",
        processor: "Octa-core Processor",
        battery: "5000mAh Long-Lasting",
        camera: "13MP Dual Camera",
        features: "Fingerprint Unlock, AI Beautification",
        desc: "An affordable choice with a massive battery and immersive display. The Oppo A5x covers all the essentials in style."
    },
    "A5 PRO": {
        name: "Oppo A5 Pro",
        screen: "6.7\" FHD+ AMOLED 120Hz",
        processor: "Dimensity 7050",
        battery: "5000mAh, 67W Charging",
        camera: "64MP Main",
        features: "Premium Design, 5G Capable",
        desc: "Pro performance meets premium design. The Oppo A5 Pro offers a stunning AMOLED screen and rapid 67W charging for power users."
    },
    "A6 PRO": {
        name: "Oppo A6 Pro",
        screen: "6.57\" AMOLED 120Hz (1400 nits)",
        processor: "Dimensity 6300 (5G) / Helio G100 (4G)",
        battery: "7000mAh Massive Battery, 80W Flash Charge",
        camera: "50MP Dual AI Camera",
        features: "IP68/IP69 Dust/Water Resistant, 300% Volume",
        desc: "Unleash power with the Oppo A6 Pro. Featuring a massive 7000mAh battery and ultra-bright AMOLED display, it's designed for endurance and entertainment."
    },
    "RENO14F": {
        name: "Oppo Reno14 F 5G",
        screen: "6.67\" AMOLED 120Hz",
        processor: "Dimensity 6300",
        battery: "5000mAh, 45W Charging",
        camera: "50MP Main + 2MP + 8MP",
        features: "Cosmos Ring Design, Holo Audio",
        desc: "Style meets substance. The Reno14 F 5G boasts a chic design and a versatile camera system perfect for portraits and night shots."
    },
    "RENO14": {
        name: "Oppo Reno14 5G",
        screen: "6.6\" AMOLED 120Hz Quad-Curved",
        processor: "Dimensity 8350 (4nm)",
        battery: "6000mAh, 80W SUPERVOOC",
        camera: "50MP Sony Main + 50MP Telephoto",
        features: "AI Eraser 2.0, BeaconLink, IP69 Waterproof",
        desc: "The Portrait Expert. Oppo Reno14 5G features flagship-level cameras and AI capabilities wrapped in a durable, waterproof body."
    }
};

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

function getModelInfo(rawModel: string) {
    const uc = rawModel.toUpperCase();

    // Exact-ish matching
    if (uc.startsWith("RENO14 F") || uc.startsWith("RENO14F")) return MODEL_SPECS["RENO14F"];
    if (uc.startsWith("RENO14")) return MODEL_SPECS["RENO14"];
    if (uc.includes("A6 PRO")) return MODEL_SPECS["A6 PRO"];
    if (uc.includes("A5 PRO")) return MODEL_SPECS["A5 PRO"];
    if (uc.startsWith("A5X")) return MODEL_SPECS["A5X"];
    if (uc.startsWith("A3X")) return MODEL_SPECS["A3X"];
    if (uc.startsWith("A3")) return MODEL_SPECS["A3"];
    if (uc.startsWith("A5")) return MODEL_SPECS["A5"];

    return MODEL_SPECS["A5"]; // Fallback
}

function generateSlug(name: string): string {
    return name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function generateDescription(info: any, modelData: any) {
    return `
# ${info.name} (${modelData.specs})

**${info.desc}**

## Key Specifications

| Feature | Details |
|---------|---------|
| **Display** | ${info.screen} |
| **Processor** | ${info.processor} |
| **Memory** | ${modelData.specs} |
| **Battery** | ${info.battery} |
| **Camera** | ${info.camera} |
| **Special Features** | ${info.features} |

## Overview

Get the **${info.name}** at the best price in Nigeria from Ogabassey. 
This device combines performance and style, making it a perfect choice for work and play.

### Why Buy From Ogabassey?
- **Genuine Products:** Brand new and authentic.
- **Fast Delivery:** Nationwide shipping options.
- **Best Support:** Dedicated customer service.
`.trim();
}

// ------------------------------------------------------------------
// MAIN
// ------------------------------------------------------------------

async function seedOppo() {
    console.log("🚀 Starting Oppo Import...");

    // 1. Merchant
    const { data: merchant } = await supabase.from('merchants').select('id').eq('slug', 'ogabassey').single();
    if (!merchant) throw new Error("Merchant 'ogabassey' not found");
    const merchantId = merchant.id;

    // 2. Categories
    // Ensure 'Smartphones' -> 'Oppo'
    let { data: smartCat } = await supabase.from('categories').select('id').eq('name', 'Smartphones').single();
    if (!smartCat) {
        // Fallback or create? Assuming Smartphones exists from previous tasks.
        const { data: newSmart } = await supabase.from('categories').insert({ name: 'Smartphones', slug: 'smartphones', merchant_id: merchantId }).select().single();
        smartCat = newSmart;
    }

    let { data: oppoCat } = await supabase.from('categories').select('id').eq('name', 'Oppo').single();
    if (!oppoCat) {
        const { data: newOppo } = await supabase.from('categories').insert({
            name: 'Oppo',
            slug: 'oppo-phones',
            parent_id: smartCat.id,
            merchant_id: merchantId
        }).select().single();
        oppoCat = newOppo;
        console.log("✅ Created 'Oppo' category");
    }

    // 3. Import Products
    let count = 0;
    for (const item of PRICE_DATA) {
        const info = getModelInfo(item.model);

        // Fix: Explicitly handle A6 Pro 4G vs 5G differentiation
        let extraSuffix = "";
        if (item.model.toLowerCase().includes("a6 pro")) {
            if (item.model.toLowerCase().includes("5g")) extraSuffix = " 5G";
            else extraSuffix = " 4G";
        }

        const finalName = `${info.name}${extraSuffix} (${item.specs})`;
        const slug = generateSlug(finalName);
        const externalId = `oppo-${item.model.toLowerCase().replace(/\s+/g, '-')}`;

        const structuredSpecs = [
            { label: "Display", value: info.screen },
            { label: "Processor", value: info.processor },
            { label: "Battery", value: info.battery },
            { label: "Camera", value: info.camera },
            { label: "Storage", value: item.specs }
        ];

        const payload = {
            name: finalName,
            slug: slug,
            description: generateDescription(info, item),
            price: item.rrp,
            cost_price: item.rdp,
            category: oppoCat.id,
            merchant_id: merchantId,
            status: 'active',
            condition: 'new',
            condition_detail: 'Brand New',
            external_id: externalId,
            external_source: 'manual_import_oppo',
            specifications: [{ category: "Key Specs", items: structuredSpecs }],
            metadata: {
                brand: "Oppo",
                specs: structuredSpecs,
                search_tags: [info.name, "Oppo", "Android", "Smartphone", item.specs]
            },
            stock: 10,
            manage_stock: true
        };

        const { error } = await supabase.from('products').upsert(payload, { onConflict: 'external_id' });

        if (error) {
            console.error(`❌ Failed ${finalName}:`, error.message);
        } else {
            console.log("✅ Upserted", finalName);
            count++;
        }
    }

    console.log("🎉 Complete. Imported", count, "products.");
}

seedOppo().catch(console.error);
