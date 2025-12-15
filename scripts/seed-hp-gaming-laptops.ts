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
    series: 'victus' | 'omen' | 'omen-max';
    features: string[];
}

interface GamingLaptopProduct {
    name: string;
    sku: string;
    specs: GamingLaptopSpecs;
    cost_price: number;
    stock: number | null;
    soldOut?: boolean;
}

// ------------------------------------------------------------------
// MARKUP CALCULATION (20%)
// ------------------------------------------------------------------
const MARKUP_RATE = 1.20;

function calculateSellingPrice(costPrice: number): number {
    return Math.round(costPrice * MARKUP_RATE);
}

// ------------------------------------------------------------------
// DESCRIPTION GENERATOR (Gaming Laptops - EAV Compliant)
// ------------------------------------------------------------------
function generateDescription(product: GamingLaptopProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const isOmen = specs.series === 'omen' || specs.series === 'omen-max';
    const seriesName = isOmen ? 'HP OMEN' : 'HP Victus';

    // Build description with Question-Based H2s
    let description = `
## What is the ${name} Price in Nigeria?

The ${name} Gaming Laptop is priced at **${priceStr}** at Ogabassey with official HP warranty. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making high-performance gaming accessible to Nigerian gamers and content creators alike.

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

    // Features section
    if (specs.features && specs.features.length > 0) {
        description += `\n## What Features Does the ${name} Have?\n\n`;
        description += specs.features.map(f => `- 🎮 ${f}`).join('\n');
    }

    // Gaming Performance Section
    description += `

## Is the ${name} Good for Gaming?

The ${name} delivers exceptional gaming performance with its **${specs.graphics}** (${specs.graphicsVram} dedicated VRAM) and **${specs.processorGen} ${specs.processor}** processor. The ${specs.refreshRate} ${specs.displaySize} display at ${specs.resolution} resolution ensures smooth, tear-free visuals in competitive and AAA gaming titles.

## What Games Can the ${name} Run?

With **${specs.graphics}** graphics, this laptop can handle:
- **AAA Titles**: God of War, Elden Ring, Cyberpunk 2077, GTA V
- **Competitive Games**: Valorant, CS2, Apex Legends, Fortnite (144+ FPS)
- **Creative Work**: Adobe Premiere Pro, DaVinci Resolve, Blender 3D

## Why Buy the ${name} from Ogabassey?

- ✅ **Best Price:** ${priceStr} with official HP warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** Sealed in box with HP ${specs.warranty}
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Gamer Support:** Physical office in Ikeja for after-sales service
- ✅ **WhatsApp Order:** Message us for quick checkout

## Related Gaming Laptops

- [HP OMEN Max](/ogabassey/laptops/hp) - Ultimate Performance
- [Dell Alienware](/ogabassey/laptops/dell) - Dell Gaming Alternative
- [MSI Gaming](/ogabassey/laptops/msi) - MSI Alternative
- [Asus ROG](/ogabassey/laptops/asus) - Asus Gaming Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// HP GAMING LAPTOPS DATA
// ------------------------------------------------------------------
const HP_GAMING_LAPTOPS: GamingLaptopProduct[] = [
    // Victus Series (Entry/Mid Gaming)
    {
        name: 'HP Victus 15-FA2013',
        sku: 'B95WHUA#ABA',
        specs: {
            processor: 'Intel Core i5-13420H',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA RTX 3050',
            graphicsVram: '6GB',
            os: 'Windows 11',
            color: 'Mica Silver',
            warranty: '1 Year HP Warranty',
            series: 'victus',
            features: ['Backlit Keyboard', '144Hz Display', 'RTX 3050']
        },
        cost_price: 939000,
        stock: 13
    },
    {
        name: 'HP Victus 15-FA0033',
        sku: '9T9R8UA#ABA',
        specs: {
            processor: 'Intel Core i5-12450H',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA RTX 3050',
            graphicsVram: '4GB',
            os: 'Windows 11',
            color: 'Performance Blue',
            warranty: '1 Year HP Warranty',
            series: 'victus',
            features: ['Backlit Keyboard', '144Hz Display', 'RTX 3050']
        },
        cost_price: 959000,
        stock: null
    },
    {
        name: 'HP Victus 15-FA2082',
        sku: 'B5EQ3UA#ABA',
        specs: {
            processor: 'Intel Core i5-13420H',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR4',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA RTX 4050',
            graphicsVram: '6GB',
            os: 'Windows 11',
            color: 'Mica Silver',
            warranty: '1 Year HP Warranty',
            series: 'victus',
            features: ['Backlit Keyboard', '144Hz Display', 'RTX 4050', '16GB RAM']
        },
        cost_price: 1024000,
        stock: 17
    },
    {
        name: 'HP Victus 15-FB0028',
        sku: '677H9UA#ABA',
        specs: {
            processor: 'AMD Ryzen 7 5800H',
            processorGen: '',
            ram: '16GB',
            ramType: 'DDR4-3200 (2x8GB)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe TLC M.2 SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA RTX 3050 Ti',
            graphicsVram: '4GB',
            os: 'Windows 11',
            color: 'Mica Silver',
            warranty: '1 Year HP Warranty',
            series: 'victus',
            features: ['Backlit Keyboard', '144Hz IPS', 'RTX 3050 Ti', 'AMD Ryzen 7']
        },
        cost_price: 1153000,
        stock: 1
    },
    {
        name: 'HP Victus 15-FB3093',
        sku: 'BM4X8UA#ABA',
        specs: {
            processor: 'AMD Ryzen 7 7445HS',
            processorGen: '',
            ram: '16GB',
            ramType: 'DDR5-5600 (2x8GB)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA GeForce RTX 4050',
            graphicsVram: '6GB GDDR6',
            os: 'Windows 11',
            color: 'Mica Silver',
            warranty: '1 Year Manufacturer Warranty',
            series: 'victus',
            features: ['Backlit Numeric Keyboard', '144Hz IPS', 'RTX 4050', 'DDR5 RAM']
        },
        cost_price: 1287000,
        stock: 21
    },
    {
        name: 'HP Victus 15-FA1163',
        sku: '9T3V7UA#ABA',
        specs: {
            processor: 'Intel Core i7-12650H',
            processorGen: '12th Gen',
            ram: '16GB',
            ramType: 'DDR4',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA RTX 4050',
            graphicsVram: '6GB',
            os: 'Windows 11',
            color: 'Performance Blue',
            warranty: '1 Year HP Warranty',
            series: 'victus',
            features: ['Backlit Keyboard', '144Hz IPS', 'RTX 4050', 'Core i7']
        },
        cost_price: 1433000,
        stock: null
    },
    {
        name: 'HP Victus 15-fa2010nia',
        sku: 'C1RD6EA',
        specs: {
            processor: 'Intel Core i7-13620H',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA GeForce RTX 4050',
            graphicsVram: '6GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Mica Silver',
            warranty: '1 Year Channel Warranty',
            series: 'victus',
            features: ['Backlit Keyboard', '144Hz IPS', 'RTX 4050', '13th Gen i7']
        },
        cost_price: 1441000,
        stock: null
    },
    {
        name: 'HP Victus 15-FA2093',
        sku: 'B97DTUA#ABA',
        specs: {
            processor: 'Intel Core i7-13620H',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR5-5200 (2x8GB)',
            storage: '1TB',
            storageType: 'PCIe NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA RTX 5060',
            graphicsVram: '8GB',
            os: 'Windows 11',
            color: 'Mica Silver',
            warranty: '1 Year HP Warranty',
            series: 'victus',
            features: ['Backlit Keyboard', '144Hz', 'RTX 5060', '1TB SSD', 'DDR5']
        },
        cost_price: 1773000,
        stock: 21
    },
    {
        name: 'HP Victus 16-R0085',
        sku: '8Y487UA#ABA',
        specs: {
            processor: 'Intel Core i7-13700H',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR5',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: 'FHD IPS',
            displaySize: '16.1"',
            resolution: '1920x1080',
            refreshRate: '144Hz',
            graphics: 'NVIDIA RTX 4070',
            graphicsVram: '8GB',
            os: 'Windows 11',
            color: 'Mica Silver',
            warranty: '1 Year HP Warranty',
            series: 'victus',
            features: ['RGB Backlit Keyboard', '144Hz IPS', 'RTX 4070', '16.1" Display']
        },
        cost_price: 2357000,
        stock: 4
    },

    // OMEN Series (High-End Gaming)
    {
        name: 'HP OMEN Slim 16-AN0037',
        sku: 'C54V1UA#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 255H',
            processorGen: '',
            ram: '16GB',
            ramType: 'DDR5',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: '2K IPS',
            displaySize: '16"',
            resolution: '2560x1600',
            refreshRate: '165Hz',
            graphics: 'NVIDIA RTX 5060',
            graphicsVram: '8GB',
            os: 'Windows 11',
            color: 'Shadow Black',
            warranty: '1 Year HP Warranty',
            series: 'omen',
            features: ['Backlit Keyboard', '165Hz QHD+', 'RTX 5060', 'Slim Design']
        },
        cost_price: 1815000,
        stock: 15
    },
    {
        name: 'HP OMEN Gaming 16-wf1008nia',
        sku: 'B0RT3EA',
        specs: {
            processor: 'Intel Core i7-14700HX',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600 (2x8GB)',
            storage: '1TB',
            storageType: 'PCIe Gen4 NVMe TLC M.2 SSD',
            display: 'FHD IPS',
            displaySize: '16.1"',
            resolution: '1920x1080',
            refreshRate: '165Hz',
            graphics: 'NVIDIA GeForce RTX 4050',
            graphicsVram: '6GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Shadow Black',
            warranty: '1 Year Channel Warranty',
            series: 'omen',
            features: ['White Backlit Keyboard', '165Hz Display', 'RTX 4050', '14th Gen i7']
        },
        cost_price: 1872000,
        stock: 3
    },
    {
        name: 'HP OMEN 16-AN0119',
        sku: 'BM7B9UA#ABA',
        specs: {
            processor: 'Intel Core Ultra 9 285H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5',
            storage: '1TB',
            storageType: 'PCIe Gen4 NVMe SSD',
            display: 'WQXGA',
            displaySize: '16"',
            resolution: '2560x1600',
            refreshRate: '240Hz',
            graphics: 'NVIDIA RTX 5070',
            graphicsVram: '8GB',
            os: 'Windows 11',
            color: 'Shadow Black',
            warranty: '1 Year HP Warranty',
            series: 'omen',
            features: ['RGB Backlit Keyboard', '240Hz QHD+', 'RTX 5070', 'Intel AI Boost', 'Core Ultra 9']
        },
        cost_price: 2344000,
        stock: null
    },

    // OMEN MAX Series (Ultimate Performance)
    {
        name: 'HP OMEN MAX 16-ah0097TX',
        sku: 'B64BNUA#ABA',
        specs: {
            processor: 'Intel Core Ultra 9 275HX',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'DDR5-5600 (2x16GB)',
            storage: '1TB',
            storageType: 'PCIe Gen5 NVMe M.2 SSD',
            display: 'WQXGA',
            displaySize: '16"',
            resolution: '2560x1600',
            refreshRate: '240Hz',
            graphics: 'NVIDIA RTX 5080',
            graphicsVram: '16GB',
            os: 'Windows 11',
            color: 'Shadow Black Aluminium',
            warranty: '1 Year HP Warranty',
            series: 'omen-max',
            features: ['Backlit Keyboard', '240Hz QHD+', 'RTX 5080 16GB', 'PCIe Gen5 SSD', '32GB DDR5']
        },
        cost_price: 4874000,
        stock: 1
    },
    {
        name: 'HP OMEN MAX 16T-AH000',
        sku: 'A4NQ6AV-01',
        specs: {
            processor: 'Intel Core Ultra 9 275HX',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'DDR5-5600 (2x16GB)',
            storage: '1TB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'WQXGA',
            displaySize: '16"',
            resolution: '2560x1600',
            refreshRate: '60-240Hz',
            graphics: 'NVIDIA RTX 5090',
            graphicsVram: '24GB',
            os: 'Windows 11',
            color: 'Shadow Black',
            warranty: '1 Year HP Warranty',
            series: 'omen-max',
            features: ['RGB Backlit Keyboard', '240Hz QHD+', 'RTX 5090 24GB', 'Ultimate Gaming']
        },
        cost_price: 5541000,
        stock: 7
    },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedHPGamingLaptops() {
    console.log("🎮 Starting HP Gaming Laptops Import (EAV v2)...\n");

    // Get Laptops Category
    const { data: laptopsCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'laptops').single();
    if (!laptopsCat) {
        console.error("❌ 'Laptops' category not found.");
        return;
    }
    const merchantId = laptopsCat.merchant_id;

    // Get HP Category (should exist from previous imports)
    let { data: hpCat } = await supabase.from('categories').select('id').eq('slug', 'hp').maybeSingle();
    const categoryId = hpCat?.id;

    // Get/Create Gaming Category
    let { data: gamingCat } = await supabase.from('categories').select('id').eq('slug', 'gaming-laptops').maybeSingle();
    if (!gamingCat) {
        console.log("✨ Creating 'Gaming Laptops' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Gaming Laptops',
            slug: 'gaming-laptops',
            parent_id: laptopsCat.id,
            merchant_id: merchantId,
            description: 'Shop gaming laptops in Nigeria. HP Victus, HP OMEN, Dell Alienware, MSI, and Asus ROG gaming laptops with high-refresh displays and RTX graphics.',
            seo_heading: 'Buy Gaming Laptops in Nigeria - HP OMEN, Victus, Alienware & More',
            seo_description: 'Shop gaming laptops at best prices in Nigeria. Discover HP OMEN MAX with RTX 5090, HP Victus budget gaming, Dell Alienware, and MSI gaming laptops. Brand new with warranty.',
        }).select().single();
        gamingCat = newCat;
        console.log("✅ Created Gaming Laptops category\n");
    }
    const gamingCategoryId = gamingCat?.id;

    // Seed Products
    console.log(`🌱 Seeding ${HP_GAMING_LAPTOPS.length} HP Gaming Laptops...\n`);

    let created = 0;
    let skipped = 0;

    for (const product of HP_GAMING_LAPTOPS) {
        const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${product.name}`);
            skipped++;
            continue;
        }

        const sellingPrice = calculateSellingPrice(product.cost_price);
        const description = generateDescription(product);

        // Build metadata
        const metadata: any = {
            brand: 'HP',
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

        console.log(`   ✨ Creating: ${product.name}`);
        console.log(`      SKU: ${product.sku} | Cost: ₦${product.cost_price.toLocaleString()} | Sell: ₦${sellingPrice.toLocaleString()}`);

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
            // Link to both HP and Gaming categories
            if (categoryId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            }
            if (gamingCategoryId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: gamingCategoryId });
            }
            console.log(`   ✅ Created & Linked to HP + Gaming`);
            created++;
        }
    }

    console.log(`\n🏁 HP Gaming Laptops Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedHPGamingLaptops().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
