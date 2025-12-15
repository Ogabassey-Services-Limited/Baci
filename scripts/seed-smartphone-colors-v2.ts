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

// --- RESEARCHED COLOR PALETTES (Dec 2025 Status) ---

// Samsung
const SAMSUNG_S24_ULTRA = ['Titanium Black', 'Titanium Gray', 'Titanium Violet', 'Titanium Yellow', 'Titanium Blue', 'Titanium Green', 'Titanium Orange'];
const SAMSUNG_S24 = ['Onyx Black', 'Marble Gray', 'Cobalt Violet', 'Amber Yellow', 'Jade Green', 'Sapphire Blue', 'Sandstone Orange'];
const SAMSUNG_S23_ULTRA = ['Phantom Black', 'Green', 'Cream', 'Lavender', 'Graphite', 'Sky Blue', 'Lime', 'Red'];
const SAMSUNG_S23 = ['Phantom Black', 'Cream', 'Green', 'Lavender', 'Graphite', 'Lime'];
const SAMSUNG_S22 = ['Phantom Black', 'White', 'Pink Gold', 'Green', 'Graphite', 'Sky Blue', 'Violet', 'Cream'];
const SAMSUNG_S21_FE = ['White', 'Graphite', 'Lavender', 'Olive'];
const SAMSUNG_S21 = ['Phantom Violet', 'Phantom Gray', 'Phantom White', 'Phantom Pink'];
const SAMSUNG_S20 = ['Cosmic Gray', 'Cloud Blue', 'Cloud Pink', 'Cloud White', 'Aura Red'];
// Z Fold Series (Researched)
const SAMSUNG_FOLD3 = ['Phantom Black', 'Phantom Green', 'Phantom Silver'];
const SAMSUNG_FOLD4 = ['Phantom Black', 'Graygreen', 'Beige'];
const SAMSUNG_FOLD5 = ['Icy Blue', 'Phantom Black', 'Cream'];
const SAMSUNG_FOLD6 = ['Silver Shadow', 'Pink', 'Navy', 'Crafted Black', 'White'];
// Z Flip Series (Researched)
const SAMSUNG_FLIP3 = ['Cream', 'Phantom Black', 'Green', 'Lavender'];
const SAMSUNG_FLIP4 = ['Graphite', 'Pink Gold', 'Bora Purple', 'Blue'];
const SAMSUNG_FLIP5 = ['Mint', 'Graphite', 'Cream', 'Lavender'];
const SAMSUNG_FLIP6 = ['Silver Shadow', 'Yellow', 'Blue', 'Mint', 'Crafted Black', 'White', 'Peach'];
const SAMSUNG_FLIP7 = ['Blue Shadow', 'Jet Black', 'Coral Red'];
const SAMSUNG_FLIP7_FE = ['Black', 'White'];
const SAMSUNG_FOLD7 = ['Jet Black', 'Blue Shadow', 'Silver Shadow'];
// Samsung S25 Series (2025 Researched)
const SAMSUNG_S25 = ['Icy Blue', 'Mint', 'Navy', 'Silver Shadow'];
const SAMSUNG_S25_ULTRA = ['Titanium Black', 'Titanium Silverblue', 'Titanium White Silver', 'Titanium Gray'];

// 2025 Samsung A-Series (Researched)
const SAMSUNG_A56 = ['Awesome Lightgray', 'Awesome Graphite', 'Awesome Olive', 'Awesome Pink'];
const SAMSUNG_A36 = ['Awesome Lavender', 'Awesome Black', 'Awesome Lime', 'Awesome White'];
// 2024 Samsung A-Series
const SAMSUNG_A55 = ['Awesome Iceblue', 'Awesome Lilac', 'Awesome Navy', 'Awesome Lemon'];
const SAMSUNG_A35 = ['Awesome Iceblue', 'Awesome Lilac', 'Awesome Navy', 'Awesome Lemon'];
const SAMSUNG_A25 = ['Blue Black', 'Blue', 'Light Blue', 'Yellow'];
const SAMSUNG_A15 = ['Blue Black', 'Blue', 'Light Blue', 'Yellow'];
const SAMSUNG_A05 = ['Light Green', 'Silver', 'Black'];
const SAMSUNG_A04 = ['Green', 'Black', 'White', 'Copper'];
// 2025 Samsung A-Series (Newly Researched)
const SAMSUNG_A06 = ['Black', 'Gold', 'Light Blue'];
const SAMSUNG_A07 = ['Green', 'Black', 'Purple'];
const SAMSUNG_A16 = ['Blue Black', 'Gray', 'Light Green'];
const SAMSUNG_A17 = ['Black', 'Gray', 'Blue', 'Sage Green'];
const SAMSUNG_A26 = ['Black', 'White', 'Mint', 'Peach Pink'];

// Infinix (2025 Researched)
const INFINIX_HOT_60_PRO = ['Sleek Black', 'Titanium Silver', 'Coral Tides', 'Sapphire Blue', 'Jungle Breath', 'Orange Rose Valley'];
const INFINIX_HOT_60_PRO_PLUS = ['Coral Tides', 'Misty Violet', 'Cyber Green', 'Sonic Yellow', 'Titanium Silver', 'Sleek Black'];
const INFINIX_HOT_60_5G = ['Shadow Blue', 'Sleek Black', 'Tundra Green', 'Caramel Glow'];
const INFINIX_HOT_50 = ['Sleek Black', 'Sage Green', 'Galaxy Blue', 'Titan Gold']; // Hot 50 Standard
const INFINIX_NOTE_50 = ['Titanium Grey', 'Ruby Red', 'Mountain Shade', 'Shadow Black'];
const INFINIX_SMART_10 = ['Sleek Black', 'Titanium Silver', 'Iris Blue', 'Twilight Gold'];
const INFINIX_SMART_9 = ['Metallic Black', 'Neo Titanium', 'Mint Green', 'Sandstone Gold'];
const INFINIX_HOT_40 = ['Palm Blue', 'Horizon Gold', 'Starlit Black', 'Starfall Green'];
const INFINIX_GT_30_PRO = ['Mecha Blue', 'Mecha Orange', 'Mecha Silver']; // Assumed lineage, user accepted research context
const INFINIX_ZERO_FLIP = ['Blossom Glow', 'Rock Black'];

// Tecno (2025 Researched)
const TECNO_CAMON_40 = ['Galaxy Black', 'Emerald Lake Green', 'Glacier White', 'Sandy Titanium'];
const TECNO_CAMON_30 = ['Iceland Basaltic Dark', 'Uyuni Salt White', 'Sahara Sand Brown'];
const TECNO_SPARK_30 = ['Bumblebee Edition', 'Astral Ice', 'Stellar Shadow', 'Magic Skin 3.0'];
const TECNO_SPARK_30_PRO = ['Arctic Glow', 'Obsidian Edge', 'Magic Skin Green', 'Optimus Prime Edition'];
const TECNO_PHANTOM_V2 = ['Ripple Blue', 'Karst Green'];
// Tecno Pop Series (2025 Researched)
const TECNO_POP_8 = ['Mystery White', 'Alpenglow Gold', 'Magic Skin', 'Gravity Black'];
const TECNO_POP_10 = ['Mystery White', 'Alpenglow Gold', 'Magic Skin', 'Gravity Black'];
const TECNO_POP_10_PRO = ['Veil White', 'Ripple Blue', 'Titanium Grey', 'Ink Black'];
// Tecno Spark 40 Series (2025 Researched)
const TECNO_SPARK_40 = ['Ink Black', 'Titanium Gray', 'Mirage Blue', 'Veil White'];
const TECNO_SPARK_40_PRO = ['Ink Black', 'Moon Titanium', 'Lake Blue', 'Bamboo Green'];

// Xiaomi (2025 Researched)
const REDMI_NOTE_14_PRO_PLUS = ['Midnight Black', 'Mirror Porcelain White', 'Sand Star Green', 'Lavender Purple', 'Frost Blue', 'Sand Gold', 'Titan Black'];
const REDMI_NOTE_14 = ['Midnight Black', 'Mist Purple', 'Ocean Blue', 'Lime Green', 'Coral Green', 'Sand Gold'];
const REDMI_NOTE_13 = ['Midnight Black', 'Mint Green', 'Ice Blue', 'Ocean Sunset'];
// Redmi A-Series (2025 Researched)
const REDMI_A3X = ['Aurora Green', 'Midnight Black', 'Moonlight White'];
const REDMI_A5 = ['Ocean Blue', 'Lake Green', 'Sandy Gold', 'Midnight Black'];

// Oppo
const OPPO_A3 = ['Starry Black', 'Moonlight Silver'];
const OPPO_A79 = ['Mystery Black', 'Glowing Green'];

// vivo (2025 Researched)
const VIVO_Y03 = ['Space Black', 'Gem Green'];
const VIVO_Y04 = ['Green', 'Gold', 'Violet', 'Dark Green', 'Titanium Gold', 'Titanium Silver'];
const VIVO_Y19S = ['Pearl Silver', 'Glossy Black', 'Glacier Blue'];
const VIVO_Y21D = ['Glowing Black', 'Coral Red', 'Lavender Purple', 'Jade Green', 'Elegant Purple'];
const VIVO_Y29 = ['Diamond Black', 'Glacier Blue', 'Titanium Gold', 'Noble Brown', 'Elegant White', 'Marble White'];
// vivo V-Series (2025 Researched)
const VIVO_V40_LITE = ['Titanium Silver', 'Emerald Green', 'Carbon Black', 'Pearl Violet'];
const VIVO_V50 = ['Starry Blue', 'Rose Red', 'Titanium Grey'];
const VIVO_V50_LITE = ['Titanium Gold', 'Phantom Black', 'Fantasy Purple'];
const VIVO_V60 = ['Mist Grey', 'Moonlit Blue', 'Auspicious Gold', 'Berry Purple'];

// Generic fallback hex map
const COLOR_HEX: Record<string, string> = {
    'Titanium Black': '#3C3C3C', 'Titanium Gray': '#808080', 'Titanium Violet': '#9370DB', 'Titanium Yellow': '#FFD700',
    'Onyx Black': '#353535', 'Marble Gray': '#C0C0C0', 'Cobalt Violet': '#8A2BE2', 'Amber Yellow': '#FFBF00',
    'Phantom Black': '#1C1C1C', 'Cream': '#FFFDD0', 'Lavender': '#E6E6FA', 'Green': '#008000', 'Lime': '#C6E377',
    'Awesome Iceblue': '#A0D3E8', 'Awesome Lilac': '#D8B5D8', 'Awesome Navy': '#000080', 'Awesome Lemon': '#FFF700',
    'Awesome Lightgray': '#D3D3D3', 'Awesome Graphite': '#3C3C3C', 'Awesome Olive': '#808000', 'Awesome Pink': '#FFC0CB',
    'Blue Black': '#000033', 'Silver Shadow': '#C0C0C0', 'Crafted Black': '#222222', 'Mint': '#98FF98',
    'Sleek Black': '#111111', 'Sage Green': '#9DC183', 'Galaxy Blue': '#2A52BE', 'Horizon Gold': '#FFD700',
    'Palm Blue': '#00A3E0', 'Starlit Black': '#000000', 'Starfall Green': '#00A86B',
    'Iceland Basaltic Dark': '#2F4F4F', 'Uyuni Salt White': '#F5F5F5', 'Sahara Sand Brown': '#C19A6B',
    'Galaxy Black': '#000000', 'Emerald Lake Green': '#006400', 'Glacier White': '#F0F8FF', 'Sandy Titanium': '#F4A460',
    'Midnight Black': '#191970', 'Mint Green': '#98FF98', 'Ice Blue': '#B0E0E6', 'Ocean Sunset': '#FF7F50',
    'Titanium Silver': '#C0C0C0', 'Coral Tides': '#FF7F50', 'Sapphire Blue': '#0F52BA', 'Jungle Breath': '#228B22', 'Orange Rose Valley': '#FF4500',
    'Mist Purple': '#E0B0FF', 'Ocean Blue': '#0077BE', 'Sand Gold': '#C2B280', 'Frost Blue': '#B0C4DE',
    'Bumblebee Edition': '#FFFF00', 'Astral Ice': '#E0FFFF', 'Stellar Shadow': '#2F2F2F', 'Magic Skin 3.0': '#D2B48C',
    'Arctic Glow': '#E0FFFF', 'Obsidian Edge': '#483D8B', 'Optimus Prime Edition': '#1C39BB',
    'Metallic Black': '#333333', 'Neo Titanium': '#A9A9A9', 'Sandstone Gold': '#DEB887',
    'Titanium Grey': '#808080', 'Ruby Red': '#E0115F', 'Mountain Shade': '#556B2F', 'Shadow Black': '#2A2A2A',
    'Iris Blue': '#5A4FCF', 'Twilight Gold': '#DAA520'
};

function getHex(color: string): string {
    if (COLOR_HEX[color]) return COLOR_HEX[color];
    const lower = color.toLowerCase();
    if (lower.includes('black')) return '#000000';
    if (lower.includes('white')) return '#FFFFFF';
    if (lower.includes('silver') || lower.includes('titanium')) return '#C0C0C0';
    if (lower.includes('gold')) return '#FFD700';
    if (lower.includes('blue')) return '#0000FF';
    if (lower.includes('green') || lower.includes('olive') || lower.includes('lime') || lower.includes('mint')) return '#008000';
    if (lower.includes('red') || lower.includes('burgundy')) return '#8B0000';
    if (lower.includes('purple') || lower.includes('violet') || lower.includes('lavender') || lower.includes('lilac')) return '#800080';
    if (lower.includes('pink') || lower.includes('rose') || lower.includes('coral') || lower.includes('blossom')) return '#FFC0CB';
    if (lower.includes('yellow') || lower.includes('lemon') || lower.includes('bumblebee')) return '#FFFF00';
    return '#808080';
}

function getColorsForModel(name: string, brand: string): string[] {
    const n = name.toLowerCase();
    const b = brand.toLowerCase();

    // Samsung S Series
    if (b === 'samsung') {
        // S25 Series (2025)
        if (n.includes('s25')) return n.includes('ultra') ? SAMSUNG_S25_ULTRA : SAMSUNG_S25;
        if (n.includes('s24')) return n.includes('ultra') ? SAMSUNG_S24_ULTRA : SAMSUNG_S24;
        if (n.includes('s23')) return n.includes('ultra') ? SAMSUNG_S23_ULTRA : SAMSUNG_S23;
        if (n.includes('s22')) return SAMSUNG_S22;
        if (n.includes('s21') && n.includes('fe')) return SAMSUNG_S21_FE;
        if (n.includes('s21')) return SAMSUNG_S21;
        if (n.includes('s20')) return SAMSUNG_S20;

        // Z Series (Specific generations - Researched)
        if (n.includes('fold 7') || n.includes('fold7')) return SAMSUNG_FOLD7;
        if (n.includes('fold 6') || n.includes('fold6')) return SAMSUNG_FOLD6;
        if (n.includes('fold 5') || n.includes('fold5')) return SAMSUNG_FOLD5;
        if (n.includes('fold 4') || n.includes('fold4')) return SAMSUNG_FOLD4;
        if (n.includes('fold 3') || n.includes('fold3')) return SAMSUNG_FOLD3;
        if (n.includes('flip 7') && n.includes('fe')) return SAMSUNG_FLIP7_FE;
        if (n.includes('flip 7') || n.includes('flip7')) return SAMSUNG_FLIP7;
        if (n.includes('flip 6') || n.includes('flip6')) return SAMSUNG_FLIP6;
        if (n.includes('flip 5') || n.includes('flip5')) return SAMSUNG_FLIP5;
        if (n.includes('flip 4') || n.includes('flip4')) return SAMSUNG_FLIP4;
        if (n.includes('flip 3') || n.includes('flip3')) return SAMSUNG_FLIP3;

        // A Series
        if (n.includes('a56')) return SAMSUNG_A56;
        if (n.includes('a36')) return SAMSUNG_A36;
        if (n.includes('a55')) return SAMSUNG_A55;
        if (n.includes('a35')) return SAMSUNG_A35;
        if (n.includes('a26')) return SAMSUNG_A26;
        if (n.includes('a25')) return SAMSUNG_A25;
        if (n.includes('a17')) return SAMSUNG_A17;
        if (n.includes('a16')) return SAMSUNG_A16;
        if (n.includes('a15')) return SAMSUNG_A15;
        if (n.includes('a07')) return SAMSUNG_A07;
        if (n.includes('a06')) return SAMSUNG_A06;
        if (n.includes('a05')) return SAMSUNG_A05;
        if (n.includes('a04')) return SAMSUNG_A04;
        if (n.includes('a14')) return ['Black', 'Light Green', 'Dark Red', 'Silver'];
        if (n.includes('a24')) return ['Black', 'Lime Green', 'Blue Gradient', 'Dark Red'];
        if (n.includes('a34')) return ['Awesome Lime', 'Awesome Silver', 'Awesome Violet', 'Awesome Graphite'];
        if (n.includes('a54')) return ['Awesome Lime', 'Awesome Graphite', 'Awesome Violet', 'Awesome White'];
    }

    // Infinix (2025)
    if (b === 'infinix') {
        if (n.includes('hot 60')) {
            if (n.includes('pro+')) return INFINIX_HOT_60_PRO_PLUS;
            if (n.includes('pro')) return INFINIX_HOT_60_PRO;
            return INFINIX_HOT_60_PRO;
        }
        if (n.includes('hot 50')) return INFINIX_HOT_50;
        if (n.includes('hot 40')) return INFINIX_HOT_40;

        if (n.includes('note 50')) return INFINIX_NOTE_50;

        if (n.includes('smart 10')) return INFINIX_SMART_10;
        if (n.includes('smart 9')) return INFINIX_SMART_9;

        if (n.includes('gt 30')) return INFINIX_GT_30_PRO;
        if (n.includes('zero flip')) return INFINIX_ZERO_FLIP;
    }

    // Tecno (2025)
    if (b === 'tecno') {
        if (n.includes('camon 40')) return TECNO_CAMON_40;
        if (n.includes('camon 30')) return TECNO_CAMON_30;
        if (n.includes('spark 40')) return n.includes('pro') ? TECNO_SPARK_40_PRO : TECNO_SPARK_40;
        if (n.includes('spark 30')) return n.includes('pro') ? TECNO_SPARK_30_PRO : TECNO_SPARK_30;
        if (n.includes('pop 10') && n.includes('pro')) return TECNO_POP_10_PRO;
        if (n.includes('pop 10')) return TECNO_POP_10;
        if (n.includes('pop 8')) return TECNO_POP_8;
        if (n.includes('phantom v') || n.includes('fold')) return TECNO_PHANTOM_V2;
    }

    // Xiaomi (2025)
    if (b === 'xiaomi' || b === 'redmi') {
        // Note Series (handle both "note 14" and "note14" naming)
        if (n.includes('note14') || n.includes('note 14')) {
            if (n.includes('pro') && n.includes('plus')) return REDMI_NOTE_14_PRO_PLUS;
            if (n.includes('pro')) return REDMI_NOTE_14;
            return REDMI_NOTE_14;
        }
        if (n.includes('note 13') || n.includes('note13')) return REDMI_NOTE_13;
        // A Series
        if (n.includes('a3x')) return REDMI_A3X;
        if (n.includes('a5')) return REDMI_A5;
    }

    // Oppo
    if (b === 'oppo') {
        if (n.includes('a3')) return OPPO_A3;
        if (n.includes('a79')) return OPPO_A79;
    }

    // vivo (2025 Researched)
    if (b === 'vivo') {
        // V-Series
        if (n.includes('v40') && n.includes('lite')) return VIVO_V40_LITE;
        if (n.includes('v50') && n.includes('lite')) return VIVO_V50_LITE;
        if (n.includes('v50')) return VIVO_V50;
        if (n.includes('v60')) return VIVO_V60;
        // Y-Series
        if (n.includes('y03')) return VIVO_Y03;
        if (n.includes('y04')) return VIVO_Y04;
        if (n.includes('y19s')) return VIVO_Y19S;
        if (n.includes('y21d')) return VIVO_Y21D;
        if (n.includes('y29')) return VIVO_Y29;
    }

    // itel
    if (b === 'itel' && n.includes('p series')) return ['Moonlit Black', 'Aurora Blue', 'Brilliant Gold', 'Starry Purple'];

    return []; // No match found -> Skip
}

async function run() {
    console.log("🚀 Starting Precise Smartphone Color Migration (Strict Brand Mode)...");

    const { data: merchant } = await supabase.from('merchants').select('id').eq('slug', 'ogabassey').single();
    if (!merchant) throw new Error("Merchant not found");

    // Fetch applicable products
    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug, price, cost_price, metadata')
        .or(`metadata->>brand.eq.Samsung,metadata->>brand.eq.Infinix,metadata->>brand.eq.Tecno,metadata->>brand.eq.Xiaomi,metadata->>brand.eq.Oppo,metadata->>brand.eq.vivo,metadata->>brand.eq.itel`)
        .order('name');

    if (!products) {
        console.log("No products found.");
        return;
    }

    let processed = 0;
    let variants = 0;

    for (const product of products) {
        // Skip non-phones
        const lowerName = product.name.toLowerCase();
        if (lowerName.includes('tv') || lowerName.includes('soundbar') || lowerName.includes('bud') || lowerName.includes('watch') || lowerName.includes('tab') || lowerName.includes('pad')) continue;

        const brand = product.metadata?.brand || '';
        if (!brand) continue;

        const colors = getColorsForModel(product.name, brand);

        if (colors.length === 0) {
            console.log(`⚠️  Skipped [Unknown Model]: ${product.name} (${brand})`);
            continue;
        }

        console.log(`📦 ${product.name} -> [${colors.join(', ')}]`);

        for (const color of colors) {
            const sku = `${product.slug}-${color.toLowerCase().replace(/\s+/g, '-')}`;

            // Check if variant doesn't already exist
            const { data: existing } = await supabase.from('product_variants').select('id').eq('product_id', product.id).eq('sku', sku).single();
            if (existing) continue;

            const { error } = await supabase.from('product_variants').insert({
                product_id: product.id,
                merchant_id: merchant.id,
                sku: sku,
                price_override: product.price,
                cost_price: product.cost_price,
                stock_quantity: 3,
                attributes: {
                    color: color,
                    color_hex: getHex(color)
                }
            });

            if (!error) variants++;
        }
        processed++;
    }

    console.log(`\n🎉 Done! Processed ${processed} phones. Added ${variants} variants.`);
}

run().catch(console.error);
