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
interface PrinterSpecs {
    type: 'inkjet' | 'laser' | 'laserjet' | 'smart-tank';
    function: 'print-only' | 'print-scan-copy' | 'print-scan-copy-fax';
    color: boolean;
    wireless: boolean;
    duplex: boolean;
    printSpeed: string;
    paperSize: string;
    connectivity: string[];
    monthlyDutyCycle?: string;
    features: string[];
    productColor: string;
    warranty: string;
}

interface PrinterProduct {
    name: string;
    sku: string;
    specs: PrinterSpecs;
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
function generateDescription(product: PrinterProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const typeName = {
        'inkjet': 'Inkjet Printer',
        'laser': 'Laser Printer',
        'laserjet': 'LaserJet Printer',
        'smart-tank': 'Smart Tank Printer'
    }[specs.type];

    const functionName = {
        'print-only': 'Printer',
        'print-scan-copy': 'All-in-One (Print/Scan/Copy)',
        'print-scan-copy-fax': 'All-in-One (Print/Scan/Copy/Fax)'
    }[specs.function];

    let description = `
## What is the ${name} Price in Nigeria?

The ${name} ${typeName} is priced at **${priceStr}** at Ogabassey with official HP warranty. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making professional printing accessible for Nigerian businesses, offices, and home users.

## What are the ${name} Specifications?

| Specification | Value |
|---------------|-------|
| **Type** | ${typeName} |
| **Function** | ${functionName} |
| **Color Printing** | ${specs.color ? '✅ Yes (Color)' : '❌ No (Mono/Black)'} |
| **Wireless** | ${specs.wireless ? '✅ Yes (Wi-Fi)' : '❌ No'} |
| **Auto-Duplex** | ${specs.duplex ? '✅ Yes (2-Sided)' : '❌ No'} |
| **Print Speed** | ${specs.printSpeed} |
| **Paper Size** | ${specs.paperSize} |
| **Connectivity** | ${specs.connectivity.join(', ')} |
${specs.monthlyDutyCycle ? `| **Monthly Duty Cycle** | ${specs.monthlyDutyCycle} |` : ''}
| **Warranty** | ${specs.warranty} |
| **Model/SKU** | ${sku} |
`;

    if (specs.features && specs.features.length > 0) {
        description += `\n## What Features Does the ${name} Have?\n\n`;
        description += specs.features.map(f => `- ✔️ ${f}`).join('\n');
    }

    // Type-specific sections
    if (specs.type === 'smart-tank') {
        description += `

## Is the HP Smart Tank Good for High Volume Printing?

Yes! The ${name} uses refillable ink tanks instead of expensive cartridges, delivering up to **6,000 black pages** or **8,000 color pages** per bottle. This makes it the most cost-effective option for high-volume home and office printing in Nigeria.
`;
    } else if (specs.type === 'laserjet' || specs.type === 'laser') {
        description += `

## Is the ${name} Good for Office Use?

The ${name} is designed for business environments with fast print speeds up to **${specs.printSpeed}**${specs.monthlyDutyCycle ? ` and a monthly duty cycle of ${specs.monthlyDutyCycle}` : ''}. LaserJet technology delivers sharp text and professional documents at a lower cost per page than inkjet.
`;
    }

    description += `

## Why Buy the ${name} from Ogabassey?

- ✅ **Best Price:** ${priceStr} with official HP warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** Sealed in box with ${specs.warranty}
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Bulk Orders:** Contact us for office bulk pricing
- ✅ **Ink/Toner Available:** We stock original HP supplies

## Related Products

- [HP LaserJet Printers](/ogabassey/printers) - Business Printing
- [HP Smart Tank](/ogabassey/printers) - High Volume, Low Cost
- [HP Monitors](/ogabassey/monitors) - Complete Your Office
`;

    return description.trim();
}

// ------------------------------------------------------------------
// HP PRINTERS DATA
// ------------------------------------------------------------------
const HP_PRINTERS: PrinterProduct[] = [
    // Inkjet / DeskJet
    {
        name: 'HP DeskJet 2710e All-in-One',
        sku: '26K72B',
        specs: {
            type: 'inkjet',
            function: 'print-scan-copy',
            color: true,
            wireless: true,
            duplex: false,
            printSpeed: '7.5 ppm black, 5.5 ppm color',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'HP Smart App'],
            features: ['HP+ Smart Printing', 'Mobile Print', 'Compact Design'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 82000,
        stock: null
    },
    {
        name: 'HP DeskJet 2820e All-in-One',
        sku: '588K9B',
        specs: {
            type: 'inkjet',
            function: 'print-scan-copy',
            color: true,
            wireless: true,
            duplex: false,
            printSpeed: '7.5 ppm black, 5.5 ppm color',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'HP Smart App'],
            features: ['HP+ Smart Printing', 'Borderless Printing', 'Mobile Print'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 89000,
        stock: null
    },
    {
        name: 'HP DeskJet 4120e All-in-One',
        sku: '26Q90B',
        specs: {
            type: 'inkjet',
            function: 'print-scan-copy',
            color: true,
            wireless: true,
            duplex: true,
            printSpeed: '8.5 ppm black, 5.5 ppm color',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'HP Smart App', 'ADF'],
            features: ['Auto Document Feeder (ADF)', 'Auto-Duplex', 'HP+ Smart Printing'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 105000,
        stock: null
    },

    // Smart Tank (High Volume, Low Cost)
    {
        name: 'HP Smart Tank 580 All-in-One',
        sku: '1F3Y2A',
        specs: {
            type: 'smart-tank',
            function: 'print-scan-copy',
            color: true,
            wireless: true,
            duplex: false,
            printSpeed: '12 ppm black, 5 ppm color',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'Bluetooth', 'HP Smart App'],
            features: ['Refillable Ink Tanks', 'Low Cost Per Page', 'Spill-Free Refill', 'Up to 6000 Black / 8000 Color Pages'],
            productColor: 'Grey/White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 195000,
        stock: null
    },
    {
        name: 'HP Smart Tank 720 All-in-One',
        sku: '6UU46A',
        specs: {
            type: 'smart-tank',
            function: 'print-scan-copy',
            color: true,
            wireless: true,
            duplex: true,
            printSpeed: '15 ppm black, 9 ppm color',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'Ethernet', 'HP Smart App'],
            features: ['Auto-Duplex', 'ADF', 'Refillable Tanks', 'Up to 6000 Black / 8000 Color Pages'],
            productColor: 'Grey/White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 278000,
        stock: null
    },
    {
        name: 'HP Smart Tank 790 All-in-One',
        sku: '4WF66A',
        specs: {
            type: 'smart-tank',
            function: 'print-scan-copy-fax',
            color: true,
            wireless: true,
            duplex: true,
            printSpeed: '15 ppm black, 9 ppm color',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'Ethernet', 'Fax', 'HP Smart App'],
            features: ['Fax Capability', 'Auto-Duplex', 'ADF', 'Touch Screen', 'Up to 6000 Black / 8000 Color Pages'],
            productColor: 'Grey/White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 328000,
        stock: null
    },

    // LaserJet (Black/Mono)
    {
        name: 'HP LaserJet M110we',
        sku: '7MD66E',
        specs: {
            type: 'laserjet',
            function: 'print-only',
            color: false,
            wireless: true,
            duplex: false,
            printSpeed: '21 ppm',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'HP Smart App'],
            monthlyDutyCycle: '10,000 pages',
            features: ['Compact Design', 'HP+ Smart Printing', 'Fast First Page'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 155000,
        stock: null
    },
    {
        name: 'HP LaserJet MFP M141w',
        sku: '7MD74A',
        specs: {
            type: 'laserjet',
            function: 'print-scan-copy',
            color: false,
            wireless: true,
            duplex: false,
            printSpeed: '21 ppm',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'HP Smart App'],
            monthlyDutyCycle: '10,000 pages',
            features: ['All-in-One', 'Flatbed Scanner', 'HP+ Smart Printing'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 198000,
        stock: null
    },
    {
        name: 'HP LaserJet Pro M404dn',
        sku: 'W1A53A',
        specs: {
            type: 'laserjet',
            function: 'print-only',
            color: false,
            wireless: false,
            duplex: true,
            printSpeed: '40 ppm',
            paperSize: 'A4',
            connectivity: ['USB', 'Ethernet', 'Gigabit Ethernet'],
            monthlyDutyCycle: '80,000 pages',
            features: ['Auto-Duplex', 'Gigabit Ethernet', 'Fast Performance', 'Enterprise Ready'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 398000,
        stock: null
    },
    {
        name: 'HP LaserJet Pro MFP M428fdn',
        sku: 'W1A29A',
        specs: {
            type: 'laserjet',
            function: 'print-scan-copy-fax',
            color: false,
            wireless: false,
            duplex: true,
            printSpeed: '40 ppm',
            paperSize: 'A4',
            connectivity: ['USB', 'Ethernet', 'Gigabit Ethernet', 'Fax'],
            monthlyDutyCycle: '80,000 pages',
            features: ['Fax', 'Auto-Duplex', 'ADF', 'Touch Screen', 'Enterprise Ready'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 598000,
        stock: null
    },
    {
        name: 'HP LaserJet Pro MFP M428fdw',
        sku: 'W1A30A',
        specs: {
            type: 'laserjet',
            function: 'print-scan-copy-fax',
            color: false,
            wireless: true,
            duplex: true,
            printSpeed: '40 ppm',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'Ethernet', 'Fax'],
            monthlyDutyCycle: '80,000 pages',
            features: ['Wireless', 'Fax', 'Auto-Duplex', 'ADF', 'Touch Screen'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 648000,
        stock: null
    },

    // Color LaserJet
    {
        name: 'HP Color LaserJet Pro M255dw',
        sku: '7KW64A',
        specs: {
            type: 'laserjet',
            function: 'print-only',
            color: true,
            wireless: true,
            duplex: true,
            printSpeed: '22 ppm',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'Ethernet'],
            monthlyDutyCycle: '40,000 pages',
            features: ['Color Laser', 'Auto-Duplex', 'Wireless', 'Fast Color Output'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 495000,
        stock: null
    },
    {
        name: 'HP Color LaserJet Pro MFP M283fdw',
        sku: '7KW75A',
        specs: {
            type: 'laserjet',
            function: 'print-scan-copy-fax',
            color: true,
            wireless: true,
            duplex: true,
            printSpeed: '22 ppm',
            paperSize: 'A4',
            connectivity: ['Wi-Fi', 'USB', 'Ethernet', 'Fax'],
            monthlyDutyCycle: '40,000 pages',
            features: ['Color All-in-One', 'Fax', 'Auto-Duplex', 'ADF', 'Touch Screen'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 695000,
        stock: null
    },
    {
        name: 'HP Color LaserJet Enterprise M455dn',
        sku: '3PZ95A',
        specs: {
            type: 'laserjet',
            function: 'print-only',
            color: true,
            wireless: false,
            duplex: true,
            printSpeed: '28 ppm',
            paperSize: 'A4',
            connectivity: ['USB', 'Gigabit Ethernet'],
            monthlyDutyCycle: '55,000 pages',
            features: ['Enterprise Grade', 'High Volume Color', 'JetIntelligence', 'Security Features'],
            productColor: 'White',
            warranty: '1 Year HP Warranty'
        },
        cost_price: 895000,
        stock: null
    },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedHPPrinters() {
    console.log("🖨️ Starting HP Printers Import (EAV v2)...\n");

    // Get merchant_id from Laptops category (existing)
    const { data: laptopsCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'laptops').single();
    if (!laptopsCat) {
        console.error("❌ 'Laptops' category not found.");
        return;
    }
    const merchantId = laptopsCat.merchant_id;

    // Get/Create Printers Category
    let { data: printerCat } = await supabase.from('categories').select('id').eq('slug', 'printers').maybeSingle();
    if (!printerCat) {
        console.log("✨ Creating 'Printers' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Printers',
            slug: 'printers',
            parent_id: null,
            merchant_id: merchantId,
            description: 'Shop HP printers in Nigeria. Discover DeskJet, Smart Tank, LaserJet, and Color LaserJet for home and office printing.',
            seo_heading: 'Buy HP Printers in Nigeria - LaserJet, Smart Tank, DeskJet & More',
            seo_description: 'Shop HP printers at best prices in Nigeria. Discover HP LaserJet for business, Smart Tank for high volume low cost printing, and DeskJet for home use. Brand new with warranty.',
        }).select().single();
        printerCat = newCat;
        console.log("✅ Created Printers category\n");
    }

    // Seed Printers
    console.log("🌱 Seeding", HP_PRINTERS.length, "HP Printers...\n");
    let created = 0;
    let skipped = 0;

    for (const product of HP_PRINTERS) {
        const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log("   ⏩ Skipping existing:", product.name);
            skipped++;
            continue;
        }

        const sellingPrice = calculateSellingPrice(product.cost_price);
        const description = generateDescription(product);

        const metadata: any = {
            brand: 'HP',
            model: product.name,
            sku: product.sku,
            condition: 'New',
            printerType: product.specs.type,
            printerFunction: product.specs.function,
            colorPrinting: product.specs.color,
            wireless: product.specs.wireless,
            duplex: product.specs.duplex,
            printSpeed: product.specs.printSpeed,
            paperSize: product.specs.paperSize,
            connectivity: product.specs.connectivity,
            productType: 'printer',
            color: product.specs.productColor,
            warranty: product.specs.warranty,
            features: product.specs.features,
        };

        if (product.specs.monthlyDutyCycle) {
            metadata.monthlyDutyCycle = product.specs.monthlyDutyCycle;
        }

        console.log("   ✨ Creating:", product.name);
        console.log("      Cost: ₦" + product.cost_price.toLocaleString() + " | Sell: ₦" + sellingPrice.toLocaleString());

        const { data: newProd, error } = await supabase.from('products').insert({
            name: `${product.name} (New)`,
            slug: slug,
            merchant_id: merchantId,
            price: sellingPrice,
            cost_price: product.cost_price,
            description: description,
            metadata: metadata,
            category: 'Printers',
            status: 'active',
            stock: product.stock,
            manage_stock: product.stock !== null,
            condition: 'new',
            condition_detail: 'Brand New'
        }).select().single();

        if (error) {
            console.error("   ❌ Failed:", product.name, error.message);
        } else {
            if (printerCat?.id) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: printerCat.id });
            }
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    console.log(`\n🏁 HP Printers Seeding Complete!`);
    console.log("   Created:", created, "| Skipped:", skipped);
}

seedHPPrinters();
