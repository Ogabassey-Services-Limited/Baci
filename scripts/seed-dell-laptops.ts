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
    category: 'consumer' | 'business' | 'gaming' | 'workstation';
    type: 'laptop' | 'convertible' | '2-in-1' | 'workstation';
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
// DESCRIPTION GENERATOR (Dell Laptops - EAV Compliant)
// ------------------------------------------------------------------
function generateDescription(product: LaptopProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const isGaming = specs.category === 'gaming';
    const isBusiness = specs.category === 'business';
    const isWorkstation = specs.category === 'workstation';

    let description = `
## What is the ${name} Price in Nigeria?

The ${name} is priced at **${priceStr}** at Ogabassey with official Dell warranty. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making premium ${isGaming ? 'gaming' : isBusiness ? 'business' : 'computing'} accessible to Nigerian professionals and enthusiasts.

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

The ${name} delivers exceptional gaming performance with its **${specs.graphics}** ${specs.graphicsVram ? `(${specs.graphicsVram} dedicated)` : ''} graphics and **${specs.processorGen} ${specs.processor}** processor. Perfect for AAA gaming, streaming, and content creation.
`;
    } else if (isBusiness) {
        description += `

## Is the ${name} Good for Business Use?

The ${name} is engineered for enterprise reliability with **${specs.processorGen} ${specs.processor}** performance, robust security features, and Dell's premium build quality. Ideal for corporate deployments and remote work.
`;
    } else if (isWorkstation) {
        description += `

## Is the ${name} Good for Professional Work?

The ${name} Precision Workstation is certified for professional applications including CAD, 3D rendering, and data science. Features **${specs.graphics}** ${specs.graphicsVram ? `(${specs.graphicsVram})` : ''} graphics for demanding creative workflows.
`;
    }

    description += `

## Why Buy the ${name} from Ogabassey?

- ✅ **Best Price:** ${priceStr} with official Dell warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** Sealed in box with Dell ${specs.warranty}
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Support:** Physical office in Ikeja for after-sales service

## Related Products

- [Dell XPS Series](/ogabassey/laptops/dell) - Premium Ultrabook
- [HP EliteBook](/ogabassey/laptops/hp) - HP Alternative
- [Lenovo ThinkPad](/ogabassey/laptops/lenovo) - Lenovo Alternative
- [MacBook Pro](/ogabassey/macbook) - Apple Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// DELL LAPTOPS DATA (From user's price list)
// ------------------------------------------------------------------
const DELL_LAPTOPS: LaptopProduct[] = [
    // Vostro Series (Entry Business)
    {
        name: 'Dell Vostro 3530 (i5 8GB)',
        sku: 'N0F5M',
        specs: {
            processor: 'Intel Core i5-1335U',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR4',
            storage: '512GB',
            storageType: 'SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Carbon Black',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Numeric Keypad', 'Ubuntu Linux']
        },
        cost_price: 498000,
        stock: null
    },
    {
        name: 'Dell Vostro 3530 (i5 16GB)',
        sku: '4X2RX',
        specs: {
            processor: 'Intel Core i5-1335U',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR4',
            storage: '512GB',
            storageType: 'SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Carbon Black',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Numeric Keypad', '16GB RAM']
        },
        cost_price: 616000,
        stock: null
    },
    {
        name: 'Dell Vostro 3530 (i7)',
        sku: '623GW',
        specs: {
            processor: 'Intel Core i7-1355U',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR4',
            storage: '512GB',
            storageType: 'SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Carbon Black',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Core i7', 'Ubuntu Linux']
        },
        cost_price: 698000,
        stock: null
    },

    // Latitude Series (Premium Business)
    {
        name: 'Dell Latitude 3540 (Ultra 5)',
        sku: 'YW3DT',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '8GB',
            ramType: 'DDR5-5200',
            storage: '256GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Gray',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Core Ultra 5', 'DDR5 RAM', 'Enterprise Ready']
        },
        cost_price: 733000,
        stock: null
    },
    {
        name: 'Dell Latitude 3540 (Ultra 5 512GB)',
        sku: 'FT0JW',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '8GB',
            ramType: 'DDR5-5200',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Gray',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Core Ultra 5', '512GB SSD', 'Enterprise Ready']
        },
        cost_price: 772000,
        stock: null
    },
    {
        name: 'Dell Latitude 3540 (Ultra 5 16GB)',
        sku: '6KVKT',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5200',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Gray',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Core Ultra 5', '16GB DDR5', 'Enterprise Ready']
        },
        cost_price: 820000,
        stock: null
    },
    {
        name: 'Dell Latitude 3540 (Ultra 7)',
        sku: '10RHJ',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5200',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Gray',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Core Ultra 7', '16GB DDR5', 'Enterprise Ready']
        },
        cost_price: 1072000,
        stock: null
    },
    {
        name: 'Dell Latitude 3450 14" (Ultra 5)',
        sku: 'TVJYP',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '8GB',
            ramType: 'DDR5',
            storage: '256GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '14"',
            resolution: '1920x1080',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Gray',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Core Ultra 5', '14" Portable', 'Enterprise Ready']
        },
        cost_price: 787000,
        stock: null
    },
    {
        name: 'Dell Latitude 5550 (Ultra 5)',
        sku: 'NYP5D',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '8GB',
            ramType: 'DDR5-5600',
            storage: '256GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Gray',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Core Ultra 5', 'DDR5-5600', 'Premium Business']
        },
        cost_price: 1177000,
        stock: null
    },
    {
        name: 'Dell Latitude 5550 (Ultra 7)',
        sku: 'V3TVM',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Ubuntu Linux',
            color: 'Gray',
            warranty: '1 Year Dell Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Core Ultra 7', '16GB DDR5', 'Premium Business']
        },
        cost_price: 1436000,
        stock: null
    },

    // Precision Workstation
    {
        name: 'Dell Precision 3590 (RTX 500 Ada)',
        sku: 'GPW3V',
        specs: {
            processor: 'Intel Core Ultra 7 155H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'NVIDIA RTX 500 Ada Generation',
            graphicsType: 'dedicated',
            graphicsVram: '4GB GDDR6',
            os: 'Ubuntu Linux',
            color: 'Titan Gray',
            warranty: '3 Years Dell Warranty',
            category: 'workstation',
            type: 'workstation',
            features: ['RTX 500 Ada', '3 Year Warranty', 'ISV Certified']
        },
        cost_price: 2098000,
        stock: null
    },

    // Gaming - G Series & Alienware
    {
        name: 'Dell G15 5530 (RTX 3050)',
        sku: '8KF6D',
        specs: {
            processor: 'Intel Core i5-13450HX',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR5',
            storage: '512GB',
            storageType: 'SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'NVIDIA GeForce RTX 3050',
            graphicsType: 'dedicated',
            graphicsVram: '6GB',
            os: 'Ubuntu Linux',
            color: 'Dark Shadow Grey',
            warranty: '1 Year Dell Warranty',
            category: 'gaming',
            type: 'laptop',
            features: ['RTX 3050', '120Hz Display', 'Gaming Laptop']
        },
        cost_price: 935000,
        stock: null
    },
    {
        name: 'Dell G16 7640 (RTX 4060)',
        sku: 'WG4VM',
        specs: {
            processor: 'Intel Core i7-14650HX',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-4800',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'QHD+',
            displaySize: '16"',
            resolution: '2560x1600',
            graphics: 'NVIDIA GeForce RTX 4060',
            graphicsType: 'dedicated',
            graphicsVram: '8GB GDDR6',
            os: 'Ubuntu Linux',
            color: 'Metallic Gray',
            warranty: '1 Year Dell Warranty',
            category: 'gaming',
            type: 'laptop',
            features: ['RTX 4060', '165Hz QHD+', '14th Gen i7']
        },
        cost_price: 1545000,
        stock: null
    },
    {
        name: 'Dell G16 7640 (RTX 4070)',
        sku: 'DYNY9',
        specs: {
            processor: 'Intel Core i9-14900HX',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'DDR5-4800',
            storage: '1TB',
            storageType: 'NVMe SSD',
            display: 'QHD+',
            displaySize: '16"',
            resolution: '2560x1600',
            graphics: 'NVIDIA GeForce RTX 4070',
            graphicsType: 'dedicated',
            graphicsVram: '8GB GDDR6',
            os: 'Ubuntu Linux',
            color: 'Metallic Gray',
            warranty: '1 Year Dell Warranty',
            category: 'gaming',
            type: 'laptop',
            features: ['RTX 4070', '165Hz QHD+', 'Core i9', '32GB RAM']
        },
        cost_price: 2328000,
        stock: null
    },

    // Alienware (Ultimate Gaming)
    {
        name: 'Dell Alienware M16 R3 (RTX 5070 Ti)',
        sku: 'V7K9R',
        specs: {
            processor: 'Intel Core Ultra 9 285HX',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'DDR5-5600',
            storage: '2TB',
            storageType: 'NVMe SSD',
            display: 'QHD+',
            displaySize: '16"',
            resolution: '2560x1600',
            graphics: 'NVIDIA GeForce RTX 5070 Ti',
            graphicsType: 'dedicated',
            graphicsVram: '12GB GDDR7',
            os: 'Windows 11 Home',
            color: 'Dark Metallic Moon',
            warranty: '1 Year Dell Warranty',
            category: 'gaming',
            type: 'laptop',
            features: ['RTX 5070 Ti', '240Hz Display', 'Core Ultra 9', 'Alienware Premium']
        },
        cost_price: 3917000,
        stock: null
    },
    {
        name: 'Dell Alienware m18 R3 (RTX 5080)',
        sku: 'H9DW7',
        specs: {
            processor: 'Intel Core Ultra 9 275HX',
            processorGen: '14th Gen',
            ram: '64GB',
            ramType: 'DDR5-6000',
            storage: '2TB',
            storageType: 'NVMe SSD (1TB x2)',
            display: 'QHD+',
            displaySize: '18"',
            resolution: '2560x1600',
            graphics: 'NVIDIA GeForce RTX 5080',
            graphicsType: 'dedicated',
            graphicsVram: '16GB GDDR7',
            os: 'Windows 11 Home',
            color: 'Dark Metallic Moon',
            warranty: '1 Year Dell Warranty',
            category: 'gaming',
            type: 'laptop',
            features: ['RTX 5080', '300Hz Display', '64GB RAM', '18" Display', 'Alienware Ultimate']
        },
        cost_price: 5915000,
        stock: null
    },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedDellLaptops() {
    console.log("💻 Starting Dell Laptops Import (EAV v2)...\n");

    // Get Laptops Category
    const { data: laptopsCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'laptops').single();
    if (!laptopsCat) {
        console.error("❌ 'Laptops' category not found.");
        return;
    }
    const merchantId = laptopsCat.merchant_id;

    // Get/Create Dell Category
    let { data: dellCat } = await supabase.from('categories').select('id').eq('slug', 'dell').maybeSingle();
    if (!dellCat) {
        console.log("✨ Creating 'Dell' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Dell',
            slug: 'dell',
            parent_id: laptopsCat.id,
            merchant_id: merchantId,
            description: 'Shop Dell laptops in Nigeria. Discover Vostro, Latitude, Precision workstations, G-Series and Alienware gaming laptops.',
            seo_heading: 'Buy Dell Laptops in Nigeria - Latitude, Alienware, G-Series & More',
            seo_description: 'Shop Dell laptops at best prices in Nigeria. Discover Dell Alienware gaming, Latitude business, Precision workstation, and Vostro laptops. Brand new with official Dell warranty.',
        }).select().single();
        dellCat = newCat;
        console.log("✅ Created Dell category\n");
    }
    const categoryId = dellCat?.id;

    // Get Gaming Category (should exist from HP import)
    const { data: gamingCat } = await supabase.from('categories').select('id').eq('slug', 'gaming-laptops').maybeSingle();
    const gamingCategoryId = gamingCat?.id;

    // Seed Products
    console.log(`🌱 Seeding ${DELL_LAPTOPS.length} Dell Laptops...\n`);

    let created = 0;
    let skipped = 0;

    for (const product of DELL_LAPTOPS) {
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
            brand: 'Dell',
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
            // Link to Dell category
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

    console.log(`\n🏁 Dell Laptops Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedDellLaptops().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
