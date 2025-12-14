import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
// TYPES
// ------------------------------------------------------------------
interface GamingLaptopSpecs {
    processor: string;
    processorGen: string;
    ram: string;
    ramType: string;
    storage: string;
    storageType: string;
    display: string;
    displaySize: string;
    resolution: string;
    refreshRate: string;
    graphics: string;
    graphicsVram: string;
    os: string;
    color: string;
    warranty: string;
    brand: 'MSI' | 'Asus';
    series: string;
    features: string[];
}

interface GamingLaptopProduct {
    name: string;
    sku: string;
    specs: GamingLaptopSpecs;
    cost_price: number;
    stock: number | null;
}

// ------------------------------------------------------------------
// MARKUP CALCULATION (20%)
// ------------------------------------------------------------------
const MARKUP_RATE = 1.20;

function calculateSellingPrice(costPrice: number): number {
    return Math.round(costPrice * MARKUP_RATE);
}

// ------------------------------------------------------------------
// DESCRIPTION GENERATOR
// ------------------------------------------------------------------
function generateDescription(product: GamingLaptopProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const brandName = specs.brand === 'MSI' ? 'MSI' : 'Asus ROG';

    let description = `
## What is the ${name} Price in Nigeria?

The ${name} Gaming Laptop is priced at **${priceStr}** at Ogabassey with official ${specs.brand} warranty. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making high-performance gaming accessible to Nigerian gamers and esports enthusiasts.

## What are the ${name} Gaming Specifications?

| Specification | Value |
|---------------|-------|
| **Processor** | ${specs.processorGen} ${specs.processor} |
| **RAM** | ${specs.ram} ${specs.ramType} |
| **Storage** | ${specs.storage} ${specs.storageType} |
| **Display** | ${specs.displaySize} ${specs.resolution} ${specs.refreshRate} |
| **Graphics** | ${specs.graphics} (${specs.graphicsVram} Dedicated) |
| **Operating System** | ${specs.os} |
| **Color** | ${specs.color} |
| **Warranty** | ${specs.warranty} |
| **Model/SKU** | ${sku} |
`;

    if (specs.features && specs.features.length > 0) {
        description += `\n## What Features Does the ${name} Have?\n\n`;
        description += specs.features.map(f => `- 🎮 ${f}`).join('\n');
    }

    description += `

## Is the ${name} Good for Gaming?

The ${name} delivers exceptional gaming performance with its **${specs.graphics}** (${specs.graphicsVram} dedicated VRAM) and **${specs.processorGen} ${specs.processor}** processor. ${specs.brand === 'MSI' ? 'MSI gaming laptops feature Cooler Boost technology and SteelSeries keyboards.' : 'Asus ROG laptops feature intelligent cooling and Aura Sync RGB lighting.'} The ${specs.refreshRate} ${specs.displaySize} display ensures smooth, competitive gaming.

## What Games Can the ${name} Run?

With **${specs.graphics}** graphics, this laptop can handle:
- **AAA Titles**: God of War, Elden Ring, Cyberpunk 2077, GTA V at Ultra settings
- **Competitive Games**: Valorant, CS2, Apex Legends, Fortnite at 144+ FPS
- **Creative Work**: Adobe Premiere Pro, DaVinci Resolve, Blender 3D

## Why Buy the ${name} from Ogabassey?

- ✅ **Best Price:** ${priceStr} with official ${specs.brand} warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** Sealed in box
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Gamer Support:** Physical office in Ikeja for after-sales service

## Related Gaming Laptops

- [HP OMEN](/ogabassey/laptops/hp) - HP Gaming
- [Dell Alienware](/ogabassey/laptops/dell) - Dell Gaming
- [Lenovo Legion](/ogabassey/laptops/lenovo) - Lenovo Gaming
`;

    return description.trim();
}

// ------------------------------------------------------------------
// MSI & ASUS GAMING LAPTOPS DATA
// ------------------------------------------------------------------
const GAMING_LAPTOPS: GamingLaptopProduct[] = [
    // MSI Gaming Laptops
    {
        name: 'MSI Thin GF63 12UC (RTX 3050)',
        sku: '9S7-16R812-2006',
        specs: {
            processor: 'Intel Core i5-12450H',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA GeForce RTX 3050',
            graphicsVram: '4GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Black',
            warranty: '2 Years MSI Warranty',
            brand: 'MSI',
            series: 'Thin GF',
            features: ['Cooler Boost 5', '144Hz Display', 'RTX 3050', 'Thin Design']
        },
        cost_price: 1105000,
        stock: null
    },
    {
        name: 'MSI Cyborg 15 A12VE (RTX 4050)',
        sku: '9S7-15K121-262',
        specs: {
            processor: 'Intel Core i5-12450H',
            processorGen: '12th Gen',
            ram: '16GB',
            ramType: 'DDR5-4800',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA GeForce RTX 4050',
            graphicsVram: '6GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Translucent Black',
            warranty: '2 Years MSI Warranty',
            brand: 'MSI',
            series: 'Cyborg',
            features: ['Cooler Boost 5', 'Per-Key RGB', 'RTX 4050', 'Futuristic Design']
        },
        cost_price: 1249000,
        stock: null
    },
    {
        name: 'MSI Katana 15 B13VGK (RTX 4070)',
        sku: '9S7-158433-086',
        specs: {
            processor: 'Intel Core i7-13620H',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR5-4800',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA GeForce RTX 4070',
            graphicsVram: '8GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Black',
            warranty: '2 Years MSI Warranty',
            brand: 'MSI',
            series: 'Katana',
            features: ['Cooler Boost 5', 'RTX 4070', 'Core i7', 'Hi-Res Audio']
        },
        cost_price: 1869000,
        stock: null
    },
    {
        name: 'MSI Raider GE78 HX 13VF (RTX 4060)',
        sku: '9S7-17S122-1099',
        specs: {
            processor: 'Intel Core i9-13950HX',
            processorGen: '13th Gen',
            ram: '32GB',
            ramType: 'DDR5-5200',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: 'QHD+ IPS',
            displaySize: '17"',
            resolution: '2560x1600',
            refreshRate: '240Hz',
            graphics: 'NVIDIA GeForce RTX 4060',
            graphicsVram: '8GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Black',
            warranty: '2 Years MSI Warranty',
            brand: 'MSI',
            series: 'Raider',
            features: ['Core i9', '240Hz QHD+', 'Per-Key RGB', 'OverBoost Ultra']
        },
        cost_price: 3198000,
        stock: null
    },
    {
        name: 'MSI Titan GT77 HX 13VH (RTX 4080)',
        sku: '9S7-17Q111-497',
        specs: {
            processor: 'Intel Core i9-13980HX',
            processorGen: '13th Gen',
            ram: '64GB',
            ramType: 'DDR5-5600',
            storage: '2TB',
            storageType: 'NVMe SSD (1TB x2 RAID)',
            display: '4K UHD IPS',
            displaySize: '17.3"',
            resolution: '3840x2160',
            refreshRate: '144Hz',
            graphics: 'NVIDIA GeForce RTX 4080',
            graphicsVram: '12GB GDDR6',
            os: 'Windows 11 Pro',
            color: 'Core Black',
            warranty: '2 Years MSI Warranty',
            brand: 'MSI',
            series: 'Titan',
            features: ['4K 144Hz', 'Cherry MX Keyboard', '64GB RAM', 'Desktop-Class Power']
        },
        cost_price: 4680000,
        stock: null
    },

    // Asus ROG Gaming Laptops
    {
        name: 'Asus TUF Gaming A15 FA506NF (RTX 2050)',
        sku: '90NR0L11-M00L50',
        specs: {
            processor: 'AMD Ryzen 5 7535HS',
            processorGen: '',
            ram: '16GB',
            ramType: 'DDR5-4800',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA GeForce RTX 2050',
            graphicsVram: '4GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Mecha Gray',
            warranty: '2 Years Asus Warranty',
            brand: 'Asus',
            series: 'TUF Gaming',
            features: ['MIL-STD-810H', 'Anti-Dust', 'RTX 2050', 'AMD Ryzen 7000']
        },
        cost_price: 1105000,
        stock: null
    },
    {
        name: 'Asus TUF Gaming A15 FA507NV (RTX 4060)',
        sku: '90NR0LT1-M00ZG0',
        specs: {
            processor: 'AMD Ryzen 7 7735HS',
            processorGen: '',
            ram: '16GB',
            ramType: 'DDR5-4800',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA GeForce RTX 4060',
            graphicsVram: '8GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Jaeger Gray',
            warranty: '2 Years Asus Warranty',
            brand: 'Asus',
            series: 'TUF Gaming',
            features: ['MIL-STD-810H', 'RTX 4060', 'AMD Ryzen 7', 'Dolby Atmos']
        },
        cost_price: 1469000,
        stock: null
    },
    {
        name: 'Asus ROG Strix G16 G614JV (RTX 4060)',
        sku: '90NR0CZ1-M00550',
        specs: {
            processor: 'Intel Core i7-13650HX',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR5-4800',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'WQXGA IPS',
            displaySize: '16"',
            resolution: '2560x1600',
            refreshRate: '165Hz',
            graphics: 'NVIDIA GeForce RTX 4060',
            graphicsVram: '8GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Eclipse Gray',
            warranty: '2 Years Asus Warranty',
            brand: 'Asus',
            series: 'ROG Strix',
            features: ['165Hz QHD+', 'MUX Switch', 'Per-Key RGB', 'ROG Intelligent Cooling']
        },
        cost_price: 1935000,
        stock: null
    },
    {
        name: 'Asus ROG Strix G18 G814JV (RTX 4060)',
        sku: '90NR0DC4-M00010',
        specs: {
            processor: 'Intel Core i9-13980HX',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR5-4800',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: 'QHD+ IPS',
            displaySize: '18"',
            resolution: '2560x1600',
            refreshRate: '165Hz',
            graphics: 'NVIDIA GeForce RTX 4060',
            graphicsVram: '8GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Eclipse Gray',
            warranty: '2 Years Asus Warranty',
            brand: 'Asus',
            series: 'ROG Strix',
            features: ['18" Display', 'Core i9', 'Per-Key RGB', 'Dolby Vision']
        },
        cost_price: 2199000,
        stock: null
    },
    {
        name: 'Asus ROG Zephyrus G16 GU605MI (RTX 4070)',
        sku: '90NR0LD1-M00DE0',
        specs: {
            processor: 'Intel Core Ultra 7 155H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'LPDDR5X-7467',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: 'OLED',
            displaySize: '16"',
            resolution: '2560x1600',
            refreshRate: '240Hz',
            graphics: 'NVIDIA GeForce RTX 4070',
            graphicsVram: '8GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Eclipse Gray',
            warranty: '2 Years Asus Warranty',
            brand: 'Asus',
            series: 'ROG Zephyrus',
            features: ['OLED 240Hz', 'Core Ultra 7', 'Slim Design', 'Nebula HDR']
        },
        cost_price: 3199000,
        stock: null
    },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedMSIAsusGaming() {
    console.log("🎮 Starting MSI & Asus Gaming Laptops Import (EAV v2)...\n");

    // Get Laptops Category
    const { data: laptopsCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'laptops').single();
    if (!laptopsCat) {
        console.error("❌ 'Laptops' category not found.");
        return;
    }
    const merchantId = laptopsCat.merchant_id;

    // Get Gaming Category (should exist)
    const { data: gamingCat } = await supabase.from('categories').select('id').eq('slug', 'gaming-laptops').maybeSingle();
    const gamingCategoryId = gamingCat?.id;

    // Get/Create MSI Category
    let { data: msiCat } = await supabase.from('categories').select('id').eq('slug', 'msi').maybeSingle();
    if (!msiCat) {
        console.log("✨ Creating 'MSI' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'MSI',
            slug: 'msi',
            parent_id: laptopsCat.id,
            merchant_id: merchantId,
            description: 'Shop MSI gaming laptops in Nigeria. Discover Thin GF, Cyborg, Katana, Raider, and Titan series with RTX graphics.',
            seo_heading: 'Buy MSI Gaming Laptops in Nigeria - Titan, Raider, Katana & More',
            seo_description: 'Shop MSI gaming laptops at best prices in Nigeria. Discover MSI Titan with RTX 4080, Raider, Katana, and Cyborg gaming laptops. Brand new with 2-year warranty.',
        }).select().single();
        msiCat = newCat;
        console.log("✅ Created MSI category\n");
    }

    // Get/Create Asus Category
    let { data: asusCat } = await supabase.from('categories').select('id').eq('slug', 'asus').maybeSingle();
    if (!asusCat) {
        console.log("✨ Creating 'Asus' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Asus',
            slug: 'asus',
            parent_id: laptopsCat.id,
            merchant_id: merchantId,
            description: 'Shop Asus ROG gaming laptops in Nigeria. Discover TUF Gaming, ROG Strix, and ROG Zephyrus with RTX graphics.',
            seo_heading: 'Buy Asus ROG Gaming Laptops in Nigeria - Strix, Zephyrus, TUF',
            seo_description: 'Shop Asus ROG gaming laptops at best prices in Nigeria. Discover ROG Zephyrus with OLED display, ROG Strix, and TUF Gaming laptops. Brand new with 2-year warranty.',
        }).select().single();
        asusCat = newCat;
        console.log("✅ Created Asus category\n");
    }

    // Seed Products
    console.log("🌱 Seeding", GAMING_LAPTOPS.length, "MSI & Asus Gaming Laptops...\n");

    let created = 0;
    let skipped = 0;

    for (const product of GAMING_LAPTOPS) {
        const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log("   ⏩ Skipping existing:", product.name);
            skipped++;
            continue;
        }

        const sellingPrice = calculateSellingPrice(product.cost_price);
        const description = generateDescription(product);

        // Build metadata
        const metadata: any = {
            brand: product.specs.brand,
            model: product.name,
            sku: product.sku,
            condition: 'New',
            processor: product.specs.processor,
            processorGen: product.specs.processorGen,
            ram: product.specs.ram,
            ramType: product.specs.ramType,
            storage: product.specs.storage,
            storageType: product.specs.storageType,
            display: product.specs.display,
            displaySize: product.specs.displaySize,
            resolution: product.specs.resolution,
            refreshRate: product.specs.refreshRate,
            graphics: product.specs.graphics,
            graphicsVram: product.specs.graphicsVram,
            os: product.specs.os,
            color: product.specs.color,
            warranty: product.specs.warranty,
            series: product.specs.series,
            category: 'gaming',
            type: 'laptop',
            features: product.specs.features,
        };

        console.log("   ✨ Creating:", product.name);
        console.log("      SKU:", product.sku, "| Cost: ₦" + product.cost_price.toLocaleString(), "| Sell: ₦" + sellingPrice.toLocaleString());

        const { data: newProd, error } = await supabase.from('products').insert({
            name: `${product.name} Gaming Laptop (New)`,
            slug: slug,
            merchant_id: merchantId,
            price: sellingPrice,
            cost_price: product.cost_price,
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Gaming Laptops',
            status: 'active',
            stock: product.stock,
            manage_stock: product.stock !== null,
            condition: 'new',
            condition_detail: 'Brand New'
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${product.name}`, error.message);
        } else {
            // Link to brand category (MSI or Asus)
            const brandCatId = product.specs.brand === 'MSI' ? msiCat?.id : asusCat?.id;
            if (brandCatId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: brandCatId });
            }
            // Also link to Gaming category
            if (gamingCategoryId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: gamingCategoryId });
            }
            console.log("   ✅ Created & Linked to", product.specs.brand, "+ Gaming");
            created++;
        }
    }

    console.log(`\n🏁 MSI & Asus Gaming Laptops Seeding Complete!`);
    console.log("   Created:", created, "| Skipped:", skipped);
}

seedMSIAsusGaming();
