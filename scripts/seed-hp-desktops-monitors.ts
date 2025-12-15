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
interface DesktopSpecs {
    processor: string;
    processorGen: string;
    ram: string;
    ramType: string;
    storage: string;
    storageType: string;
    graphics: string;
    graphicsType: 'integrated' | 'dedicated';
    graphicsVram?: string;
    os: string;
    formFactor: 'tower' | 'sff' | 'mini' | 'aio';
    color: string;
    warranty: string;
    features: string[];
}

interface MonitorSpecs {
    displaySize: string;
    resolution: string;
    panelType: string;
    refreshRate: string;
    responseTime: string;
    aspectRatio: string;
    ports: string[];
    features: string[];
    color: string;
    warranty: string;
}

interface DesktopProduct {
    name: string;
    sku: string;
    type: 'desktop';
    specs: DesktopSpecs;
    cost_price: number;
    stock: number | null;
}

interface MonitorProduct {
    name: string;
    sku: string;
    type: 'monitor';
    specs: MonitorSpecs;
    cost_price: number;
    stock: number | null;
}

type Product = DesktopProduct | MonitorProduct;

// ------------------------------------------------------------------
// MARKUP CALCULATION (20%)
// ------------------------------------------------------------------
const MARKUP_RATE = 1.20;

function calculateSellingPrice(costPrice: number): number {
    return Math.round(costPrice * MARKUP_RATE);
}

// ------------------------------------------------------------------
// DESCRIPTION GENERATORS
// ------------------------------------------------------------------
function generateDesktopDescription(product: DesktopProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const formFactorName = {
        'tower': 'Tower Desktop',
        'sff': 'Small Form Factor Desktop',
        'mini': 'Mini Desktop',
        'aio': 'All-in-One Desktop'
    }[specs.formFactor];

    let description = `
## What is the ${name} Price in Nigeria?

The ${name} ${formFactorName} is priced at **${priceStr}** at Ogabassey with official HP warranty. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making enterprise-grade computing accessible for Nigerian businesses and professionals.

## What are the ${name} Specifications?

| Specification | Value |
|---------------|-------|
| **Processor** | ${specs.processorGen} ${specs.processor} |
| **RAM** | ${specs.ram} ${specs.ramType} |
| **Storage** | ${specs.storage} ${specs.storageType} |
| **Graphics** | ${specs.graphics}${specs.graphicsVram ? ` (${specs.graphicsVram})` : ''} |
| **Form Factor** | ${formFactorName} |
| **Operating System** | ${specs.os} |
| **Color** | ${specs.color} |
| **Warranty** | ${specs.warranty} |
| **Model/SKU** | ${sku} |
`;

    if (specs.features && specs.features.length > 0) {
        description += `\n## What Features Does the ${name} Have?\n\n`;
        description += specs.features.map(f => `- ✔️ ${f}`).join('\n');
    }

    description += `

## Is the ${name} Good for Business?

The ${name} is engineered for enterprise reliability with **${specs.processorGen} ${specs.processor}** performance, easy serviceability, and HP's business-grade durability. Ideal for offices, schools, and organizations needing dependable desktop computing.

## Why Buy the ${name} from Ogabassey?

- ✅ **Best Price:** ${priceStr} with official HP warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** Sealed in box with ${specs.warranty}
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Bulk Orders:** Contact us for enterprise volume discounts

## Related Products

- [HP Monitors](/ogabassey/monitors) - Complete Your Setup
- [HP Printers](/ogabassey/printers) - Office Printing Solutions
- [HP Laptops](/ogabassey/laptops/hp) - Portable Alternative
`;

    return description.trim();
}

function generateMonitorDescription(product: MonitorProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    let description = `
## What is the ${name} Price in Nigeria?

The ${name} Monitor is priced at **${priceStr}** at Ogabassey with official HP warranty. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making professional displays accessible for Nigerian businesses and creators.

## What are the ${name} Specifications?

| Specification | Value |
|---------------|-------|
| **Display Size** | ${specs.displaySize} |
| **Resolution** | ${specs.resolution} |
| **Panel Type** | ${specs.panelType} |
| **Refresh Rate** | ${specs.refreshRate} |
| **Response Time** | ${specs.responseTime} |
| **Aspect Ratio** | ${specs.aspectRatio} |
| **Ports** | ${specs.ports.join(', ')} |
| **Color** | ${specs.color} |
| **Warranty** | ${specs.warranty} |
| **Model/SKU** | ${sku} |
`;

    if (specs.features && specs.features.length > 0) {
        description += `\n## What Features Does the ${name} Have?\n\n`;
        description += specs.features.map(f => `- ✔️ ${f}`).join('\n');
    }

    description += `

## Is the ${name} Good for Work?

The ${name} delivers excellent visual clarity with **${specs.resolution}** resolution on a **${specs.displaySize}** ${specs.panelType} panel. The ${specs.refreshRate} refresh rate ensures smooth visuals for productivity, content creation, and casual gaming.

## Why Buy the ${name} from Ogabassey?

- ✅ **Best Price:** ${priceStr} with official HP warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** Sealed in box with ${specs.warranty}
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Bulk Orders:** Contact us for office setups

## Related Products

- [HP Desktops](/ogabassey/desktops) - Complete Your Setup
- [HP Laptops](/ogabassey/laptops/hp) - Portable Computing
`;

    return description.trim();
}

// ------------------------------------------------------------------
// HP DESKTOPS DATA
// ------------------------------------------------------------------
const HP_DESKTOPS: DesktopProduct[] = [
    {
        name: 'HP Pro Tower 280 G9 (i3)',
        sku: '882M3ET#ABV',
        type: 'desktop',
        specs: {
            processor: 'Intel Core i3-12100',
            processorGen: '12th Gen',
            ram: '4GB',
            ramType: 'DDR4-3200',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            graphics: 'Intel UHD Graphics 730',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            formFactor: 'tower',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            features: ['Tool-less Access', 'Business Ready', 'Expandable']
        },
        cost_price: 347000,
        stock: null
    },
    {
        name: 'HP Pro Tower 280 G9 (i5 8GB)',
        sku: '6W1D3EA',
        type: 'desktop',
        specs: {
            processor: 'Intel Core i5-12500',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            graphics: 'Intel UHD Graphics 770',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            formFactor: 'tower',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            features: ['Tool-less Access', 'Core i5', 'Business Ready']
        },
        cost_price: 428000,
        stock: null
    },
    {
        name: 'HP Pro Tower 280 G9 (i5 512GB)',
        sku: '6W5H2EA',
        type: 'desktop',
        specs: {
            processor: 'Intel Core i5-12500',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            graphics: 'Intel UHD Graphics 770',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            formFactor: 'tower',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            features: ['512GB SSD', 'Core i5', 'Expandable']
        },
        cost_price: 481000,
        stock: null
    },
    {
        name: 'HP Pro SFF 290 G9 (i3)',
        sku: '6W1D1EA',
        type: 'desktop',
        specs: {
            processor: 'Intel Core i3-12100',
            processorGen: '12th Gen',
            ram: '4GB',
            ramType: 'DDR4-3200',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            graphics: 'Intel UHD Graphics 730',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            formFactor: 'sff',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            features: ['Small Form Factor', 'Space Saving', 'Business Ready']
        },
        cost_price: 371000,
        stock: null
    },
    {
        name: 'HP Pro SFF 290 G9 (i5)',
        sku: '6W1D2EA',
        type: 'desktop',
        specs: {
            processor: 'Intel Core i5-12500',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            graphics: 'Intel UHD Graphics 770',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            formFactor: 'sff',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            features: ['Small Form Factor', 'Core i5', 'Space Saving']
        },
        cost_price: 446000,
        stock: null
    },
    {
        name: 'HP Pro SFF 290 G9 (i5 512GB)',
        sku: '6W5H3EA',
        type: 'desktop',
        specs: {
            processor: 'Intel Core i5-12500',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            graphics: 'Intel UHD Graphics 770',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            formFactor: 'sff',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            features: ['Small Form Factor', '512GB SSD', 'Core i5']
        },
        cost_price: 505000,
        stock: null
    },
    {
        name: 'HP ProDesk 400 G7 SFF (i5)',
        sku: '293V7EA',
        type: 'desktop',
        specs: {
            processor: 'Intel Core i5-10500',
            processorGen: '10th Gen',
            ram: '8GB',
            ramType: 'DDR4-2666',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            graphics: 'Intel UHD Graphics 630',
            graphicsType: 'integrated',
            os: 'Windows 10 Pro',
            formFactor: 'sff',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            features: ['Windows 10 Pro', 'ProDesk Series', 'Enterprise Ready']
        },
        cost_price: 578000,
        stock: null
    },
    {
        name: 'HP EliteDesk 800 G5 Mini',
        sku: '7PF61EA',
        type: 'desktop',
        specs: {
            processor: 'Intel Core i5-9500T',
            processorGen: '9th Gen',
            ram: '8GB',
            ramType: 'DDR4-2666',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            graphics: 'Intel UHD Graphics 630',
            graphicsType: 'integrated',
            os: 'Windows 10 Pro',
            formFactor: 'mini',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            features: ['Mini PC', 'Windows 10 Pro', 'VESA Mount', 'Ultra Compact']
        },
        cost_price: 686000,
        stock: null
    },
];

// ------------------------------------------------------------------
// HP MONITORS DATA
// ------------------------------------------------------------------
const HP_MONITORS: MonitorProduct[] = [
    {
        name: 'HP P22h G5 FHD Monitor',
        sku: '64W30AA',
        type: 'monitor',
        specs: {
            displaySize: '21.5"',
            resolution: '1920x1080 FHD',
            panelType: 'IPS',
            refreshRate: '75Hz',
            responseTime: '5ms',
            aspectRatio: '16:9',
            ports: ['HDMI 1.4', 'VGA', 'DisplayPort 1.2'],
            features: ['Low Blue Light', 'Height Adjustable', 'Pivot/Tilt/Swivel'],
            color: 'Black',
            warranty: '3 Years HP Warranty'
        },
        cost_price: 161000,
        stock: null
    },
    {
        name: 'HP P24h G5 FHD Monitor',
        sku: '64W30AB',
        type: 'monitor',
        specs: {
            displaySize: '23.8"',
            resolution: '1920x1080 FHD',
            panelType: 'IPS',
            refreshRate: '75Hz',
            responseTime: '5ms',
            aspectRatio: '16:9',
            ports: ['HDMI 1.4', 'VGA', 'DisplayPort 1.2'],
            features: ['Low Blue Light', 'Height Adjustable', 'Pivot/Tilt/Swivel'],
            color: 'Black',
            warranty: '3 Years HP Warranty'
        },
        cost_price: 190000,
        stock: null
    },
    {
        name: 'HP M27f FHD Monitor',
        sku: '2H0N1AA',
        type: 'monitor',
        specs: {
            displaySize: '27"',
            resolution: '1920x1080 FHD',
            panelType: 'IPS',
            refreshRate: '75Hz',
            responseTime: '5ms',
            aspectRatio: '16:9',
            ports: ['HDMI', 'VGA'],
            features: ['Ultra-Slim', 'AMD FreeSync', 'Low Blue Light'],
            color: 'Silver',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 213000,
        stock: null
    },
    {
        name: 'HP E27 G5 FHD Monitor',
        sku: '6N4E2AA',
        type: 'monitor',
        specs: {
            displaySize: '27"',
            resolution: '1920x1080 FHD',
            panelType: 'IPS',
            refreshRate: '75Hz',
            responseTime: '5ms',
            aspectRatio: '16:9',
            ports: ['HDMI 1.4', 'DisplayPort 1.2', 'USB-C (65W PD)'],
            features: ['USB-C 65W Power Delivery', 'Height Adjustable', 'Enterprise Ready'],
            color: 'Black/Silver',
            warranty: '3 Years HP Warranty'
        },
        cost_price: 348000,
        stock: null
    },
    {
        name: 'HP OMEN 27q QHD Gaming Monitor',
        sku: '780F8AA',
        type: 'monitor',
        specs: {
            displaySize: '27"',
            resolution: '2560x1440 QHD',
            panelType: 'IPS',
            refreshRate: '165Hz',
            responseTime: '1ms GtG',
            aspectRatio: '16:9',
            ports: ['HDMI 2.0', 'DisplayPort 1.4', 'USB Hub'],
            features: ['165Hz Gaming', '1ms Response', 'AMD FreeSync Premium', 'OMEN Gaming Hub'],
            color: 'Black',
            warranty: '3 Years HP Warranty'
        },
        cost_price: 435000,
        stock: null
    },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedHPDesktopsMonitors() {
    console.log("🖥️ Starting HP Desktops & Monitors Import (EAV v2)...\n");

    // Get Laptops Category to get merchant_id
    const { data: laptopsCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'laptops').single();
    if (!laptopsCat) {
        console.error("❌ 'Laptops' category not found.");
        return;
    }
    const merchantId = laptopsCat.merchant_id;

    // Get/Create Desktops Category
    let { data: desktopCat } = await supabase.from('categories').select('id').eq('slug', 'desktops').maybeSingle();
    if (!desktopCat) {
        console.log("✨ Creating 'Desktops' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Desktops',
            slug: 'desktops',
            parent_id: null,
            merchant_id: merchantId,
            description: 'Shop HP desktop computers in Nigeria. Discover Pro Tower, Pro SFF, ProDesk, and EliteDesk business desktops.',
            seo_heading: 'Buy HP Desktop Computers in Nigeria - Pro Tower, EliteDesk & More',
            seo_description: 'Shop HP desktop computers at best prices in Nigeria. Discover HP Pro Tower, Pro SFF, ProDesk, and EliteDesk business desktops. Brand new with official HP warranty.',
        }).select().single();
        desktopCat = newCat;
        console.log("✅ Created Desktops category\n");
    }

    // Get/Create Monitors Category
    let { data: monitorCat } = await supabase.from('categories').select('id').eq('slug', 'monitors').maybeSingle();
    if (!monitorCat) {
        console.log("✨ Creating 'Monitors' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Monitors',
            slug: 'monitors',
            parent_id: null,
            merchant_id: merchantId,
            description: 'Shop HP monitors in Nigeria. Discover P-Series business monitors, E-Series enterprise displays, and OMEN gaming monitors.',
            seo_heading: 'Buy HP Monitors in Nigeria - Business, Gaming & Enterprise Displays',
            seo_description: 'Shop HP monitors at best prices in Nigeria. Discover HP P-Series, E-Series enterprise monitors, and OMEN gaming displays. Brand new with 3-year warranty.',
        }).select().single();
        monitorCat = newCat;
        console.log("✅ Created Monitors category\n");
    }

    // Seed Desktops
    console.log(`🌱 Seeding ${HP_DESKTOPS.length} HP Desktops...\n`);
    let created = 0;
    let skipped = 0;

    for (const product of HP_DESKTOPS) {
        const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${product.name}`);
            skipped++;
            continue;
        }

        const sellingPrice = calculateSellingPrice(product.cost_price);
        const description = generateDesktopDescription(product);

        const metadata = {
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
            graphics: product.specs.graphics,
            graphicsType: product.specs.graphicsType,
            os: product.specs.os,
            formFactor: product.specs.formFactor,
            color: product.specs.color,
            warranty: product.specs.warranty,
            productType: 'desktop',
            features: product.specs.features,
        };

        console.log(`   ✨ Creating: ${product.name}`);
        console.log(`      Cost: ₦${product.cost_price.toLocaleString()} | Sell: ₦${sellingPrice.toLocaleString()}`);

        const { data: newProd, error } = await supabase.from('products').insert({
            name: `${product.name} (New)`,
            slug: slug,
            merchant_id: merchantId,
            price: sellingPrice,
            cost_price: product.cost_price,
            description: description,
            metadata: metadata,
            category: 'Desktops',
            status: 'active',
            stock: product.stock,
            manage_stock: product.stock !== null,
            condition: 'new',
            condition_detail: 'Brand New'
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${product.name}`, error.message);
        } else {
            if (desktopCat?.id) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: desktopCat.id });
            }
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    // Seed Monitors
    console.log(`\n🌱 Seeding ${HP_MONITORS.length} HP Monitors...\n`);

    for (const product of HP_MONITORS) {
        const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${product.name}`);
            skipped++;
            continue;
        }

        const sellingPrice = calculateSellingPrice(product.cost_price);
        const description = generateMonitorDescription(product);

        const metadata = {
            brand: 'HP',
            model: product.name,
            sku: product.sku,
            condition: 'New',
            displaySize: product.specs.displaySize,
            resolution: product.specs.resolution,
            panelType: product.specs.panelType,
            refreshRate: product.specs.refreshRate,
            responseTime: product.specs.responseTime,
            aspectRatio: product.specs.aspectRatio,
            ports: product.specs.ports,
            color: product.specs.color,
            warranty: product.specs.warranty,
            productType: 'monitor',
            features: product.specs.features,
        };

        console.log(`   ✨ Creating: ${product.name}`);
        console.log(`      Cost: ₦${product.cost_price.toLocaleString()} | Sell: ₦${sellingPrice.toLocaleString()}`);

        const { data: newProd, error } = await supabase.from('products').insert({
            name: `${product.name} (New)`,
            slug: slug,
            merchant_id: merchantId,
            price: sellingPrice,
            cost_price: product.cost_price,
            description: description,
            metadata: metadata,
            category: 'Monitors',
            status: 'active',
            stock: product.stock,
            manage_stock: product.stock !== null,
            condition: 'new',
            condition_detail: 'Brand New'
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${product.name}`, error.message);
        } else {
            if (monitorCat?.id) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: monitorCat.id });
            }
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    console.log(`\n🏁 HP Desktops & Monitors Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedHPDesktopsMonitors().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
