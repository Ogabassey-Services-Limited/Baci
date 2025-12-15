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
interface LaptopSpecs {
    processor: string;
    processorGen: string;
    ram: string;
    ramType: string;
    storage: string;
    storageType: string;
    display: string;
    displaySize: string;
    resolution: string;
    graphics: string;
    graphicsType: 'integrated' | 'dedicated';
    graphicsVram?: string;
    os: string;
    color: string;
    warranty: string;
    category: 'consumer' | 'business' | 'gaming';
    series: 'ideapad' | 'thinkpad' | 'thinkbook' | 'legion' | 'yoga';
    type: 'laptop' | 'convertible';
    features: string[];
}

interface LaptopProduct {
    name: string;
    sku: string;
    specs: LaptopSpecs;
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
// DESCRIPTION GENERATOR
// ------------------------------------------------------------------
function generateDescription(product: LaptopProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const isGaming = specs.category === 'gaming';
    const isBusiness = specs.series === 'thinkpad' || specs.series === 'thinkbook';

    let description = `
## What is the ${name} Price in Nigeria?

The ${name} is priced at **${priceStr}** at Ogabassey with official Lenovo warranty. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making premium ${isGaming ? 'gaming' : isBusiness ? 'business' : 'computing'} accessible to Nigerian professionals and enthusiasts.

## What are the ${name} Specifications?

| Specification | Value |
|---------------|-------|
| **Processor** | ${specs.processorGen} ${specs.processor} |
| **RAM** | ${specs.ram} ${specs.ramType} |
| **Storage** | ${specs.storage} ${specs.storageType} |
| **Display** | ${specs.displaySize} ${specs.resolution} ${specs.display} |
| **Graphics** | ${specs.graphics}${specs.graphicsVram ? ` (${specs.graphicsVram})` : ''} |
| **Operating System** | ${specs.os} |
| **Color** | ${specs.color} |
| **Warranty** | ${specs.warranty} |
| **Model/SKU** | ${sku} |
`;

    if (specs.features && specs.features.length > 0) {
        description += `\n## What Features Does the ${name} Have?\n\n`;
        description += specs.features.map(f => `- ✔️ ${f}`).join('\n');
    }

    if (isGaming) {
        description += `

## Is the ${name} Good for Gaming?

The Lenovo Legion ${name} delivers exceptional gaming performance with its **${specs.graphics}** ${specs.graphicsVram ? `(${specs.graphicsVram} dedicated)` : ''} graphics. Legion laptops are known for advanced cooling, high refresh displays, and competitive gaming features.
`;
    } else if (isBusiness) {
        description += `

## Is the ${name} Good for Business Use?

The ${name} is built for enterprise reliability with legendary ThinkPad durability, **${specs.processorGen} ${specs.processor}** performance, and enhanced security features. Lenovo ThinkPads are the gold standard for business laptops worldwide.
`;
    }

    description += `

## Why Buy the ${name} from Ogabassey?

- ✅ **Best Price:** ${priceStr} with official Lenovo warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** Sealed in box with Lenovo ${specs.warranty}
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Support:** Physical office in Ikeja for after-sales service

## Related Products

- [Lenovo ThinkPad](/ogabassey/laptops/lenovo) - Business Laptops
- [Lenovo Legion](/ogabassey/laptops/lenovo) - Gaming Laptops
- [HP EliteBook](/ogabassey/laptops/hp) - HP Alternative
- [Dell Latitude](/ogabassey/laptops/dell) - Dell Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// LENOVO LAPTOPS DATA
// ------------------------------------------------------------------
const LENOVO_LAPTOPS: LaptopProduct[] = [
    // IdeaPad Series (Consumer)
    {
        name: 'Lenovo IdeaPad Slim 1 14IRU9',
        sku: '83G900XFAR',
        specs: {
            processor: 'Intel Core i3-2120U',
            processorGen: '',
            ram: '8GB',
            ramType: 'LPDDR5',
            storage: '256GB',
            storageType: 'NVMe SSD',
            display: 'IPS',
            displaySize: '14"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Cloud Grey',
            warranty: '1 Year Lenovo Warranty',
            category: 'consumer',
            series: 'ideapad',
            type: 'laptop',
            features: ['Windows 11', 'Lightweight', 'NVMe SSD']
        },
        cost_price: 130000,
        stock: null
    },
    {
        name: 'Lenovo IdeaPad Slim 3 15IRH8',
        sku: '83EM0025AK',
        specs: {
            processor: 'Intel Core i5-13420H',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR5-4800',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD IPS Anti-glare',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Arctic Grey',
            warranty: '1 Year Lenovo Warranty',
            category: 'consumer',
            series: 'ideapad',
            type: 'laptop',
            features: ['DDR5 RAM', '13th Gen i5', 'Anti-glare Display']
        },
        cost_price: 543000,
        stock: null
    },
    {
        name: 'Lenovo IdeaPad Slim 5 14AHP9',
        sku: '83DE000YAK',
        specs: {
            processor: 'AMD Ryzen 5 8640HS',
            processorGen: '',
            ram: '16GB',
            ramType: 'LPDDR5X-6400 (onboard)',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: '2.8K OLED',
            displaySize: '14"',
            resolution: '2880x1800',
            graphics: 'AMD Radeon 760M Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home',
            color: 'Luna Grey',
            warranty: '1 Year Lenovo Warranty',
            category: 'consumer',
            series: 'ideapad',
            type: 'laptop',
            features: ['2.8K OLED Display', 'AMD Ryzen 8000', 'Premium Slim']
        },
        cost_price: 1042000,
        stock: null
    },

    // ThinkPad/ThinkBook Series (Business)
    {
        name: 'Lenovo ThinkBook 16 G7 IML',
        sku: '21MNCTO1WWME1',
        specs: {
            processor: 'Intel Core Ultra 5 125H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600 (2x8GB)',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'WUXGA IPS Anti-glare',
            displaySize: '16"',
            resolution: '1920x1200',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Luna Grey',
            warranty: '3 Years On-Site Warranty',
            category: 'business',
            series: 'thinkbook',
            type: 'laptop',
            features: ['Intel Arc Graphics', 'Windows 11 Pro', '3 Year On-Site', '16" Display']
        },
        cost_price: 1135000,
        stock: null
    },
    {
        name: 'Lenovo ThinkBook 16 G7 IML (Ultra 7)',
        sku: '21MNCTO1WWME2',
        specs: {
            processor: 'Intel Core Ultra 7 155H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600 (2x8GB)',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'WUXGA IPS Anti-glare',
            displaySize: '16"',
            resolution: '1920x1200',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Luna Grey',
            warranty: '3 Years On-Site Warranty',
            category: 'business',
            series: 'thinkbook',
            type: 'laptop',
            features: ['Core Ultra 7', 'Windows 11 Pro', '3 Year On-Site', 'Intel Arc']
        },
        cost_price: 1279000,
        stock: null
    },
    {
        name: 'Lenovo ThinkPad E16 Gen 2 (Ultra 5)',
        sku: '21MACTO1WWME1',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'WUXGA IPS Anti-glare',
            displaySize: '16"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Black',
            warranty: '3 Years On-Site Warranty',
            category: 'business',
            series: 'thinkpad',
            type: 'laptop',
            features: ['ThinkPad Durability', 'Windows 11 Pro', '3 Year On-Site', 'MIL-SPEC']
        },
        cost_price: 1190000,
        stock: null
    },
    {
        name: 'Lenovo ThinkPad E16 Gen 2 (Ultra 7)',
        sku: '21MACTO1WWME2',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'WUXGA IPS Anti-glare',
            displaySize: '16"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Black',
            warranty: '3 Years On-Site Warranty',
            category: 'business',
            series: 'thinkpad',
            type: 'laptop',
            features: ['Core Ultra 7', 'ThinkPad Durability', '3 Year On-Site', 'MIL-SPEC']
        },
        cost_price: 1423000,
        stock: null
    },

    // Yoga Series (Premium Consumer)
    {
        name: 'Lenovo Yoga Slim 7 14ASN8',
        sku: '82Y100EUAK',
        specs: {
            processor: 'AMD Ryzen 7 7840S',
            processorGen: '',
            ram: '16GB',
            ramType: 'LPDDR5X-6400 (onboard)',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: '2.8K OLED',
            displaySize: '14"',
            resolution: '2880x1800',
            graphics: 'AMD Radeon 780M Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home',
            color: 'Dark Teal',
            warranty: '1 Year Lenovo Warranty',
            category: 'consumer',
            series: 'yoga',
            type: 'laptop',
            features: ['2.8K OLED', 'AMD Ryzen 7', 'Premium Build', 'Dolby Atmos']
        },
        cost_price: 1178000,
        stock: null
    },
    {
        name: 'Lenovo Yoga Pro 9 16IMH9',
        sku: '83DN002CAK',
        specs: {
            processor: 'Intel Core Ultra 9 185H',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'LPDDR5X-6400 (onboard)',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: '4K Mini-LED',
            displaySize: '16"',
            resolution: '3840x2400',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home',
            color: 'Basalt Grey',
            warranty: '1 Year Lenovo Warranty',
            category: 'consumer',
            series: 'yoga',
            type: 'laptop',
            features: ['4K Mini-LED', 'Core Ultra 9', '32GB RAM', 'Dolby Vision', 'Creator Laptop']
        },
        cost_price: 2752000,
        stock: null
    },

    // Legion Series (Gaming)
    {
        name: 'Lenovo Legion 5 15IAH7H (RTX 3070)',
        sku: '82RB00UUAK',
        specs: {
            processor: 'Intel Core i7-12700H',
            processorGen: '12th Gen',
            ram: '16GB',
            ramType: 'DDR5-4800 (2x8GB)',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'NVIDIA GeForce RTX 3070',
            graphicsType: 'dedicated',
            graphicsVram: '8GB GDDR6',
            os: 'FreeDOS',
            color: 'Storm Grey',
            warranty: '2 Years Lenovo Warranty',
            category: 'gaming',
            series: 'legion',
            type: 'laptop',
            features: ['RTX 3070', '165Hz Display', 'Legion Coldfront 4.0', '2 Year Warranty']
        },
        cost_price: 1719000,
        stock: null
    },
    {
        name: 'Lenovo Legion Pro 5 16ARX8 (RTX 4070)',
        sku: '82WM00RYAK',
        specs: {
            processor: 'AMD Ryzen 7 7745HX',
            processorGen: '',
            ram: '32GB',
            ramType: 'DDR5-5600 (2x16GB)',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: 'WQXGA IPS',
            displaySize: '16"',
            resolution: '2560x1600',
            graphics: 'NVIDIA GeForce RTX 4070',
            graphicsType: 'dedicated',
            graphicsVram: '8GB GDDR6',
            os: 'FreeDOS',
            color: 'Onyx Grey',
            warranty: '2 Years Lenovo Warranty',
            category: 'gaming',
            series: 'legion',
            type: 'laptop',
            features: ['RTX 4070', '165Hz QHD+', '32GB DDR5', 'Legion TrueStrike Keyboard']
        },
        cost_price: 2477000,
        stock: null
    },
    {
        name: 'Lenovo Legion Pro 7 16IAX7 (RTX 4080)',
        sku: '82SH002QAK',
        specs: {
            processor: 'Intel Core i9-13900HX',
            processorGen: '13th Gen',
            ram: '32GB',
            ramType: 'DDR5-5600 (2x16GB)',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: 'WQXGA IPS',
            displaySize: '16"',
            resolution: '2560x1600',
            graphics: 'NVIDIA GeForce RTX 4080',
            graphicsType: 'dedicated',
            graphicsVram: '12GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Onyx Grey',
            warranty: '2 Years Lenovo Warranty',
            category: 'gaming',
            series: 'legion',
            type: 'laptop',
            features: ['RTX 4080', '240Hz QHD+', 'Core i9', 'Legion AI Engine', 'Per-Key RGB']
        },
        cost_price: 4121000,
        stock: null
    },
    {
        name: 'Lenovo Legion Pro 9 16IRX9 (RTX 4090)',
        sku: '83DF000GAK',
        specs: {
            processor: 'Intel Core i9-14900HX',
            processorGen: '14th Gen',
            ram: '64GB',
            ramType: 'DDR5-5600 (2x32GB)',
            storage: '2TB',
            storageType: 'NVMe SSD (1TB x2)',
            display: 'Mini-LED',
            displaySize: '16"',
            resolution: '3200x2000',
            graphics: 'NVIDIA GeForce RTX 4090',
            graphicsType: 'dedicated',
            graphicsVram: '16GB GDDR6',
            os: 'Windows 11 Home',
            color: 'Glacier White',
            warranty: '2 Years Lenovo Warranty',
            category: 'gaming',
            series: 'legion',
            type: 'laptop',
            features: ['RTX 4090', 'Mini-LED 165Hz', '64GB RAM', '2TB Storage', 'Ultimate Gaming']
        },
        cost_price: 4988000,
        stock: null
    },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedLenovoLaptops() {
    console.log("💻 Starting Lenovo Laptops Import (EAV v2)...\n");

    // Get Laptops Category
    const { data: laptopsCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'laptops').single();
    if (!laptopsCat) {
        console.error("❌ 'Laptops' category not found.");
        return;
    }
    const merchantId = laptopsCat.merchant_id;

    // Get/Create Lenovo Category
    let { data: lenovoCat } = await supabase.from('categories').select('id').eq('slug', 'lenovo').maybeSingle();
    if (!lenovoCat) {
        console.log("✨ Creating 'Lenovo' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Lenovo',
            slug: 'lenovo',
            parent_id: laptopsCat.id,
            merchant_id: merchantId,
            description: 'Shop Lenovo laptops in Nigeria. Discover IdeaPad, ThinkPad, ThinkBook business laptops, Yoga premium, and Legion gaming laptops.',
            seo_heading: 'Buy Lenovo Laptops in Nigeria - ThinkPad, Legion, Yoga & More',
            seo_description: 'Shop Lenovo laptops at best prices in Nigeria. Discover Lenovo Legion gaming with RTX 4090, ThinkPad business laptops, and Yoga premium 2-in-1s. Brand new with official warranty.',
        }).select().single();
        lenovoCat = newCat;
        console.log("✅ Created Lenovo category\n");
    }
    const categoryId = lenovoCat?.id;

    // Get Gaming Category
    const { data: gamingCat } = await supabase.from('categories').select('id').eq('slug', 'gaming-laptops').maybeSingle();
    const gamingCategoryId = gamingCat?.id;

    // Seed Products
    console.log(`🌱 Seeding ${LENOVO_LAPTOPS.length} Lenovo Laptops...\n`);

    let created = 0;
    let skipped = 0;

    for (const product of LENOVO_LAPTOPS) {
        if (product.soldOut) {
            console.log(`   ⏩ Skipping SOLD OUT: ${product.name}`);
            skipped++;
            continue;
        }

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
            brand: 'Lenovo',
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
            graphics: product.specs.graphics,
            graphicsType: product.specs.graphicsType,
            os: product.specs.os,
            color: product.specs.color,
            warranty: product.specs.warranty,
            category: product.specs.category,
            series: product.specs.series,
            type: product.specs.type,
            features: product.specs.features,
        };

        if (product.specs.graphicsVram) {
            metadata.graphicsVram = product.specs.graphicsVram;
        }

        console.log(`   ✨ Creating: ${product.name}`);
        console.log(`      SKU: ${product.sku} | Cost: ₦${product.cost_price.toLocaleString()} | Sell: ₦${sellingPrice.toLocaleString()}`);

        const { data: newProd, error } = await supabase.from('products').insert({
            name: `${product.name} (New)`,
            slug: slug,
            merchant_id: merchantId,
            price: sellingPrice,
            cost_price: product.cost_price,
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Laptops',
            status: 'active',
            stock: product.stock,
            manage_stock: product.stock !== null,
            condition: 'new',
            condition_detail: 'Brand New'
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${product.name}`, error.message);
        } else {
            // Link to Lenovo category
            if (categoryId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            }
            // Also link gaming laptops to Gaming category
            if (product.specs.category === 'gaming' && gamingCategoryId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: gamingCategoryId });
            }
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    console.log(`\n🏁 Lenovo Laptops Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedLenovoLaptops().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
