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
    processorGen: string;           // e.g., "14th Gen", "13th Gen"
    ram: string;
    ramType: string;                // e.g., "DDR5-5600", "DDR4-3200"
    storage: string;
    storageType: string;            // e.g., "PCIe NVMe M.2 SSD"
    display: string;
    displaySize: string;            // e.g., "14\"", "15.6\""
    resolution: string;             // e.g., "1920x1200", "1920x1080"
    graphics: string;
    graphicsType: 'integrated' | 'dedicated';
    graphicsVram?: string;          // For dedicated GPUs
    os: string;
    battery?: string;
    weight?: string;
    ports?: string[];
    features: string[];
    color: string;
    warranty: string;
    category: 'consumer' | 'business' | 'gaming' | 'workstation';
    type: 'laptop' | 'convertible' | '2-in-1' | 'chromebook';
}

interface LaptopProduct {
    name: string;
    sku: string;
    specs: LaptopSpecs;
    cost_price: number;
    stock: number | null;           // null = unknown, 0 = sold out
    soldOut?: boolean;
}

// ------------------------------------------------------------------
// MARKUP CALCULATION (20% as requested)
// ------------------------------------------------------------------
const MARKUP_RATE = 1.20;

function calculateSellingPrice(costPrice: number): number {
    return Math.round(costPrice * MARKUP_RATE);
}

// ------------------------------------------------------------------
// DESCRIPTION GENERATOR (EAV + Question-Based H2s per content-creation.md)
// ------------------------------------------------------------------
function generateDescription(product: LaptopProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const isNew = true; // All products from this list are new
    const isGaming = specs.category === 'gaming';
    const isBusiness = specs.category === 'business';
    const isConvertible = specs.type === 'convertible' || specs.type === '2-in-1';

    // Build description with Question-Based H2s (40-word extractive answers)
    let description = `
## What is the ${name} Price in Nigeria?

The ${name} is priced at **${priceStr}** at Ogabassey with official HP warranty. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making it accessible for professionals and students seeking premium ${isBusiness ? 'business' : isGaming ? 'gaming' : 'productivity'} performance.

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

    // Add features section
    if (specs.features && specs.features.length > 0) {
        description += `\n## What Features Does the ${name} Have?\n\n`;
        description += specs.features.map(f => `- ✔️ ${f}`).join('\n');
    }

    // Add ports if available
    if (specs.ports && specs.ports.length > 0) {
        description += `\n\n## Connectivity & Ports\n\n`;
        description += specs.ports.map(p => `- ${p}`).join('\n');
    }

    // Category-specific sections
    if (isGaming) {
        description += `

## Is the ${name} Good for Gaming?

The ${name} delivers excellent gaming performance with its **${specs.graphics}** ${specs.graphicsVram ? `(${specs.graphicsVram} dedicated)` : ''} graphics and **${specs.processorGen} ${specs.processor}** processor. The ${specs.resolution} ${specs.display} display ensures smooth visuals for AAA titles.
`;
    } else if (isBusiness) {
        description += `

## Is the ${name} Good for Business Use?

The ${name} is designed for enterprise workloads with **${specs.processorGen} ${specs.processor}** performance, ${specs.features.includes('Fingerprint Reader') ? 'biometric security (fingerprint reader),' : ''} and durable construction. Ideal for professionals who need reliability and mobile productivity.
`;
    } else if (isConvertible) {
        description += `

## Is the ${name} a Touchscreen Laptop?

Yes, the ${name} features a **${specs.displaySize} ${specs.resolution} Touchscreen** display that folds 360° for tablet mode. Perfect for creative professionals, students, and anyone who values versatility in a single device.
`;
    }

    // Why Buy section (transactional frame as per content-creation.md)
    description += `

## Why Buy the ${name} from Ogabassey?

- ✅ **Best Price:** ${priceStr} with official warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** ${isNew ? 'Sealed in box with HP warranty' : 'Verified Premium Used with 90-day warranty'}
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Support:** Physical office in Ikeja for after-sales service
- ✅ **WhatsApp Order:** Message us for quick checkout

## Related Products

- [HP ProBook 440 G11](/ogabassey/laptops/hp) - Business Alternative
- [Dell XPS 15](/ogabassey/laptops/dell) - Premium Alternative
- [MacBook Air M3](/ogabassey/macbook) - Apple Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// HP CONSUMER LAPTOPS DATA (From user's price list)
// ------------------------------------------------------------------
const HP_CONSUMER_LAPTOPS: LaptopProduct[] = [
    {
        name: 'HP Chromebook 11MK G9 Education Edition',
        sku: '7D2W3PC#ACJ',
        specs: {
            processor: 'MediaTek MT8183',
            processorGen: '',
            ram: '4GB',
            ramType: 'LPDDR4X',
            storage: '32GB',
            storageType: 'eMMC',
            display: 'Anti-Glare',
            displaySize: '11.6"',
            resolution: '1366x768',
            graphics: 'Integrated',
            graphicsType: 'integrated',
            os: 'Chrome OS',
            color: 'Black',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'chromebook',
            features: ['Education Edition', 'Lightweight', 'Long Battery Life', 'Chrome OS Security']
        },
        cost_price: 323000,
        stock: 22
    },
    {
        name: 'HP Laptop 15-fd0113dx',
        sku: 'C0CM1UA#ABA',
        specs: {
            processor: 'Intel Core i3-N305',
            processorGen: '',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '128GB',
            storageType: 'USF',
            display: 'Micro-edge Anti-glare',
            displaySize: '15.6"',
            resolution: '1366x768 HD',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 S',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', 'Anti-glare Display']
        },
        cost_price: 407000,
        stock: 20
    },
    {
        name: 'HP 14-EP0299',
        sku: 'BL9T2UA#ABA',
        specs: {
            processor: 'Intel Core i3-N305',
            processorGen: '',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '256GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'Standard',
            displaySize: '14"',
            resolution: '1366x768',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', 'NVMe SSD']
        },
        cost_price: 459000,
        stock: null
    },
    {
        name: 'HP 14s-dq5104nia',
        sku: '7Z6T3EA',
        specs: {
            processor: 'Intel Core i3-1215U',
            processorGen: '12th Gen',
            ram: '4GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'Standard',
            displaySize: '14"',
            resolution: '1366x768 HD',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', '12th Gen Intel', '512GB SSD']
        },
        cost_price: 505000,
        stock: null
    },
    {
        name: 'HP 15-FD0131',
        sku: '9C9A2UA#ABA',
        specs: {
            processor: 'Intel Core i3-N305',
            processorGen: '',
            ram: '8GB',
            ramType: 'DDR4',
            storage: '256GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', 'Fingerprint Reader', 'FHD Display']
        },
        cost_price: 505000,
        stock: 20
    },
    {
        name: 'HP 15-DY5131',
        sku: '8R0M1UA#ABA',
        specs: {
            processor: 'Intel Core i3-1215U',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4',
            storage: '256GB',
            storageType: 'SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', 'Fingerprint Reader', 'Iris Xe Graphics']
        },
        cost_price: 535000,
        stock: 8
    },
    {
        name: 'HP 250 G10 PC (i3)',
        sku: '8A517EA',
        specs: {
            processor: 'Intel Core i3-1315U',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Turbo Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Numeric Keypad', '13th Gen Intel']
        },
        cost_price: 538000,
        stock: 19
    },
    {
        name: 'HP Laptop 14-ep0063nia',
        sku: 'A6TE7EA',
        specs: {
            processor: 'Intel Core i3-1315U',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'Standard',
            displaySize: '14"',
            resolution: '1366x768 HD',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Natural Silver',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', '13th Gen Intel']
        },
        cost_price: 538000,
        stock: 1
    },
    {
        name: 'HP 14-EP2035',
        sku: 'B97M3UA#ABA',
        specs: {
            processor: 'Intel Core 3 N355',
            processorGen: '',
            ram: '16GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD',
            displaySize: '14"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', '16GB RAM', 'FHD Display']
        },
        cost_price: 542000,
        stock: null
    },
    {
        name: 'HP 15-DY2132 Touchscreen',
        sku: '33K47UA#ABA',
        specs: {
            processor: 'Intel Core i3-1135G4',
            processorGen: '11th Gen',
            ram: '8GB',
            ramType: 'DDR4',
            storage: '256GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD Touchscreen',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Windows 10',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Touchscreen Display', 'Windows 10']
        },
        cost_price: 559000,
        stock: 7
    },
    {
        name: 'HP 15-FD0250',
        sku: 'BY0S6UA#ABA',
        specs: {
            processor: 'Intel Core i5-1334U',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR4',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', '13th Gen i5', 'Iris Xe Graphics']
        },
        cost_price: 598000,
        stock: null
    },
    {
        name: 'HP 15-DY2075TG',
        sku: '4Q8Y1U#ABA',
        specs: {
            processor: 'Intel Core i5-1135G7',
            processorGen: '11th Gen',
            ram: '8GB',
            ramType: 'DDR4',
            storage: '256GB',
            storageType: 'SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home in S mode',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Iris Xe Graphics']
        },
        cost_price: 625000,
        stock: 7
    },
    {
        name: 'HP 15-DY2795',
        sku: '6M0Z7UA#ABA',
        specs: {
            processor: 'Intel Core i5-1135G7',
            processorGen: '11th Gen',
            ram: '8GB',
            ramType: 'DDR4',
            storage: '256GB',
            storageType: 'NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', 'Iris Xe Graphics']
        },
        cost_price: 630000,
        stock: 7
    },
    {
        name: 'HP 250 G10 PC (i5)',
        sku: 'B39TQAT',
        specs: {
            processor: 'Intel Core i5-1334U',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'FHD IPS',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Turbo Silver',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', 'IPS Display', '13th Gen i5']
        },
        cost_price: 663000,
        stock: null
    },
    {
        name: 'HP 14-DQ2088',
        sku: '2K4P8UA#ABA-NW',
        specs: {
            processor: 'Intel Core i5-1135G7',
            processorGen: '11th Gen',
            ram: '8GB',
            ramType: 'DDR4-2666',
            storage: '256GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'Standard',
            displaySize: '14"',
            resolution: '1366x768',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Aspen Green Camo',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', 'Unique Color', 'Iris Xe Graphics']
        },
        cost_price: 665000,
        stock: null
    },
    {
        name: 'HP 14-ep0180nia',
        sku: 'C40ZLEA',
        specs: {
            processor: 'Intel Core i3-N305',
            processorGen: '',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'HD',
            displaySize: '14"',
            resolution: '1366x768',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Natural Silver',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', '512GB SSD']
        },
        cost_price: 479000,
        stock: 0,
        soldOut: true
    },
    {
        name: 'HP 14-ep0176nia',
        sku: 'C40ZGEA',
        specs: {
            processor: 'Intel Core i5-1334U',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD',
            displaySize: '14"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Natural Silver',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', '13th Gen i5', 'FHD Display']
        },
        cost_price: 683000,
        stock: null
    },
    // Convertibles / OmniBook
    {
        name: 'HP OmniBook 5 Flip 14-fp0013dx',
        sku: 'B5UJ3UA#ABA',
        specs: {
            processor: 'Intel Core 5 120U',
            processorGen: '14th Gen',
            ram: '8GB',
            ramType: 'LPDDR5-5200 (onboard)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: 'Touchscreen',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Glacier Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: '2-in-1',
            features: ['Backlit Keyboard', 'Touchscreen', '360° Hinge', 'Pavilion x360 Replacement']
        },
        cost_price: 750000,
        stock: null
    },
    {
        name: 'HP OmniBook 5 Flip 14-fp0006nia',
        sku: 'C1RC9EA',
        specs: {
            processor: 'Intel Core 5 120U',
            processorGen: '14th Gen',
            ram: '8GB',
            ramType: 'LPDDR5-5200 (onboard)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '2K Touchscreen IPS',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home',
            color: 'Powder Pink',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: '2-in-1',
            features: ['Backlit Keyboard', '2K IPS Touchscreen', 'Pavilion x360 Replacement']
        },
        cost_price: 920000,
        stock: 16
    },
    {
        name: 'HP OmniBook 5 Flip 14-fp0023dx',
        sku: 'B86Q7UA#ABA',
        specs: {
            processor: 'Intel Core 7 150U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'LPDDR5-5200 (onboard)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '2K Touchscreen',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home',
            color: 'Glacier Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: '2-in-1',
            features: ['Backlit Keyboard', '2K Touchscreen', '16GB RAM', 'Pavilion x360 Replacement']
        },
        cost_price: 959000,
        stock: null
    },
    {
        name: 'HP OmniBook 5 Flip 14-fp0008nia',
        sku: 'C1RD3EA',
        specs: {
            processor: 'Intel Core 7 150U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'LPDDR5-5200 (onboard)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '2K Touchscreen IPS',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home',
            color: 'Powder Pink',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: '2-in-1',
            features: ['Backlit Keyboard', '2K IPS Touchscreen', '16GB RAM', 'Core 7']
        },
        cost_price: 1154000,
        stock: 19
    },
    {
        name: 'HP OmniBook 5 16-AF1067',
        sku: 'B5RK7UA#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 255U',
            processorGen: '',
            ram: '16GB',
            ramType: 'LPDDR5x',
            storage: '1TB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'IPS Anti-glare',
            displaySize: '16"',
            resolution: '1920x1200 WUXGA',
            graphics: 'Intel SoC Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Glacier Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', '1TB SSD', '16" Display', 'Pavilion 16 Replacement']
        },
        cost_price: 1096000,
        stock: 1
    },
    // Envy Series
    {
        name: 'HP Envy x360 14-ES1023',
        sku: '9R8R3UA#ABA',
        specs: {
            processor: 'Intel Core 7 150U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR4',
            storage: '512GB',
            storageType: 'PCI-E NVMe SSD',
            display: 'FHD Touchscreen',
            displaySize: '14"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'Touchscreen', '2-in-1 Convertible']
        },
        cost_price: 1153000,
        stock: 3
    },
    {
        name: 'HP Envy x360 2-in-1 15-fe1082wm',
        sku: '9R1K0UA#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'LPDDR5-6400 (onboard)',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD Touchscreen',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Mineral Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Core Ultra 7', 'Touchscreen']
        },
        cost_price: 1223000,
        stock: null
    },
    {
        name: 'HP Envy x360 16-AC0013',
        sku: '9S1R5UA#ABA',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'LPDDR5',
            storage: '512GB',
            storageType: 'PCIe 4.0 NVMe SSD',
            display: 'IPS Touchscreen',
            displaySize: '16"',
            resolution: '1920x1200 WUXGA',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Glacier Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', '16" Display', 'Core Ultra 5']
        },
        cost_price: 1118000,
        stock: 1
    },
    {
        name: 'HP Envy x360 2-in-1 16-ac0007nia',
        sku: 'B67E0EA',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: 'Meteor Lake (Series 1)',
            ram: '16GB',
            ramType: 'LPDDR5-6400 (onboard)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '2K IPS Touchscreen',
            displaySize: '16"',
            resolution: '1920x1200',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Glacier Silver',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Intel Arc Graphics', 'Meteor Lake']
        },
        cost_price: 1194000,
        stock: 1
    },
    // OmniBook X Premium
    {
        name: 'HP OmniBook X Flip 16-as0013dx',
        sku: 'B5UH0UA#ABA',
        specs: {
            processor: 'Intel Core Ultra 5 226V',
            processorGen: 'Next Gen AI',
            ram: '16GB',
            ramType: 'LPDDR5x-8533 (onboard)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '2K IPS Touchscreen',
            displaySize: '16"',
            resolution: '1920x1200',
            graphics: 'Intel Arc 130V GPU',
            graphicsType: 'dedicated',
            graphicsVram: '8GB',
            os: 'Windows 11 Pro',
            color: 'Eclipse Gray',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', '8GB Dedicated Graphics', 'AI PC', 'Envy 16 x360 Replacement']
        },
        cost_price: 987000,
        stock: 1
    },
    {
        name: 'HP OmniBook X Flip 14-FM0023',
        sku: 'B5UJ2UA#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 256V',
            processorGen: 'Next Gen AI',
            ram: '16GB',
            ramType: 'LPDDR5x-8533 (onboard)',
            storage: '1TB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '2K Enabled IPS Touchscreen',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Atmospheric Blue',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', '1TB SSD', 'Core Ultra 7', 'AI PC']
        },
        cost_price: 1187000,
        stock: null
    },
    {
        name: 'HP OmniBook X Flip 14-FK0033',
        sku: 'B6QE6UA#ABA',
        specs: {
            processor: 'AMD Ryzen AI 7 350',
            processorGen: '',
            ram: '24GB',
            ramType: 'LPDDR5-7500 (onboard)',
            storage: '1TB',
            storageType: 'PCIe NVMe SSD',
            display: 'Touchscreen',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'AMD Radeon 860M Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Meteor Silver',
            warranty: '1 Year Manufacturer Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', 'AMD Ryzen AI', '24GB RAM', 'Envy 14 x360 Replacement']
        },
        cost_price: 1173000,
        stock: 4
    },
    // OmniBook Ultra / Spectre Replacement
    {
        name: 'HP OmniBook Ultra 14-fd0023dx',
        sku: 'A9PS0UA#ABA',
        specs: {
            processor: 'AMD Ryzen AI 9 HX 375',
            processorGen: '',
            ram: '32GB',
            ramType: 'LPDDR5x-7500 (onboard)',
            storage: '2TB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '2.2K Touchscreen IPS',
            displaySize: '14"',
            resolution: '2240x1400',
            graphics: 'AMD Radeon 890M Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Meteor Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'IR Webcam', 'Poly Studio Quad Speakers', 'Spectre 14 Replacement']
        },
        cost_price: 1762000,
        stock: 20
    },
    {
        name: 'HP OmniBook Ultra Flip 14-fh0002nia',
        sku: 'B67DBEA',
        specs: {
            processor: 'Intel Core Ultra 7 256V',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'LPDDR5X-8533 (onboard)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '3K Touchscreen',
            displaySize: '14"',
            resolution: '2880x1800',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home',
            color: 'Atmospheric Blue',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Fingerprint Reader', '3K Display', 'Intel AI Boost', 'Spectre Replacement', 'No Pen Included']
        },
        cost_price: 1817000,
        stock: null
    },
    {
        name: 'HP OmniBook Ultra Flip 14-fh0016nia',
        sku: 'B84RBEA',
        specs: {
            processor: 'Intel Core Ultra 7 256V',
            processorGen: '',
            ram: '16GB',
            ramType: 'LPDDR5X (onboard)',
            storage: '1TB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '3K Touchscreen',
            displaySize: '14"',
            resolution: '2880x1800',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Home',
            color: 'Eclipse Grey',
            warranty: '3 Years Channel Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Fingerprint Reader', '1TB SSD', 'HP Rechargeable MPP2.0 Tilt Pen', 'Spectre 14 x360 Replacement']
        },
        cost_price: 1948000,
        stock: 16
    },
    {
        name: 'HP OmniBook Ultra Flip 14-fh0018nia',
        sku: 'B95PPEA',
        specs: {
            processor: 'Intel Core Ultra 9 288V',
            processorGen: '',
            ram: '32GB',
            ramType: 'LPDDR5X (onboard)',
            storage: '2TB',
            storageType: 'PCIe Gen4 NVMe M.2 SSD',
            display: '2.8K OLED Low Blue Light VRR 120Hz Touchscreen',
            displaySize: '14"',
            resolution: '2880x1800',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Atmospheric Blue',
            warranty: '3 Years Channel Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'OLED 120Hz', 'HP USB-C Rechargeable MPP2.0 Tilt Pen', 'Core Ultra 9']
        },
        cost_price: 2420000,
        stock: null
    },
    // Spectre
    {
        name: 'HP Spectre x360 2-in-1 16-f0025na',
        sku: '9R8C4EA',
        specs: {
            processor: 'Intel Core i7-1360P',
            processorGen: '13th Gen',
            ram: '16GB',
            ramType: 'DDR4-3200 (onboard)',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe TLC M.2 SSD',
            display: '3K+ Touchscreen',
            displaySize: '16"',
            resolution: '3K+',
            graphics: 'Intel Arc A370M',
            graphicsType: 'dedicated',
            graphicsVram: '4GB GDDR6',
            os: 'Windows 11 Pro',
            color: 'Nightfall Black',
            warranty: '1 Year Channel Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'HP Rechargeable MPP2.0 Tilt Pen', '4GB Dedicated Graphics', '3K+ Display']
        },
        cost_price: 2456000,
        stock: 3
    },
    // Pavilion
    {
        name: 'HP Pavilion 15-EG0050 Touchscreen',
        sku: '1M1F7UA#ABA',
        specs: {
            processor: 'Intel Core i5-1135G7',
            processorGen: '',
            ram: '8GB',
            ramType: 'DDR4-3200 (2x4GB)',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD Touchscreen',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 10',
            color: 'Lunar Gold',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Touchscreen', 'Iris Xe Graphics', 'Unique Color']
        },
        cost_price: 870000,
        stock: 1
    },
    {
        name: 'HP Pavilion 15-eg2088nia Touchscreen',
        sku: '764Z8EA',
        specs: {
            processor: 'Intel Core i5-1235U',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4 (2x4GB)',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD Touchscreen',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver Aluminum',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Touchscreen', 'Backlit Keyboard', 'Numeric Keypad', '12th Gen i5']
        },
        cost_price: 946000,
        stock: 16
    },
    {
        name: 'HP Pavilion x360 Convertible 15-er1015nia',
        sku: '768U1EA',
        specs: {
            processor: 'Intel Core i5-1235U',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200 (2x4GB)',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD Touchscreen',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'convertible',
            features: ['Touchscreen', 'Backlit Keyboard', 'Numeric Keypad', '360° Hinge']
        },
        cost_price: 948000,
        stock: null
    },
    // i7 Higher End
    {
        name: 'HP 15-FD0173wm',
        sku: 'BK1T3UA#ABA',
        specs: {
            processor: 'Intel Core i7-1255U',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'consumer',
            type: 'laptop',
            features: ['Windows 11', 'Core i7', 'Iris Xe']
        },
        cost_price: 841000,
        stock: 9
    },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedHPConsumerLaptops() {
    console.log("💻 Starting HP Consumer Laptops Import (EAV v2)...\n");

    // Get Laptops Category
    const { data: laptopsCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'laptops').single();
    if (!laptopsCat) {
        console.error("❌ 'Laptops' category not found.");
        return;
    }
    const merchantId = laptopsCat.merchant_id;

    // Get/Create HP Category
    let { data: hpCat } = await supabase.from('categories').select('id').eq('slug', 'hp').maybeSingle();
    if (!hpCat) {
        console.log("✨ Creating 'HP' category with SEO fields...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'HP',
            slug: 'hp',
            parent_id: laptopsCat.id,
            merchant_id: merchantId,
            description: 'Shop HP laptops in Nigeria. Discover OmniBook, Envy, Spectre premium laptops and budget-friendly HP consumer laptops.',
            seo_heading: 'Buy HP Laptops in Nigeria - OmniBook, Envy, Spectre & More',
            seo_description: 'Shop HP laptops at best prices in Nigeria. Discover HP OmniBook Ultra, Envy x360, Spectre, Pavilion and consumer laptops. Brand new with official HP warranty.',
        }).select().single();
        hpCat = newCat;
        console.log("✅ Created HP category\n");
    }
    const categoryId = hpCat?.id;

    // Seed Products
    console.log(`🌱 Seeding ${HP_CONSUMER_LAPTOPS.length} HP Consumer Laptops...\n`);

    let created = 0;
    let skipped = 0;
    let soldOut = 0;

    for (const product of HP_CONSUMER_LAPTOPS) {
        // Skip sold out items
        if (product.soldOut) {
            console.log(`   ⏩ Skipping SOLD OUT: ${product.name}`);
            soldOut++;
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
            if (categoryId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            }
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    console.log(`\n🏁 HP Consumer Laptops Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped} | Sold Out: ${soldOut}`);
}

seedHPConsumerLaptops().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
