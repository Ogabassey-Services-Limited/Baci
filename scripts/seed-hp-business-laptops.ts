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
// TYPES (Same as HP Consumer)
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
// DESCRIPTION GENERATOR (Business Laptops - EAV Compliant)
// ------------------------------------------------------------------
function generateDescription(product: LaptopProduct): string {
    const { name, sku, specs, cost_price } = product;
    const sellingPrice = calculateSellingPrice(cost_price);
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(sellingPrice);
    const monthlyPayment = Math.ceil(sellingPrice / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const isWorkstation = specs.category === 'workstation';
    const isConvertible = specs.type === 'convertible' || specs.type === '2-in-1';

    // Build description with Question-Based H2s (40-word extractive answers per content-creation.md)
    let description = `
## What is the ${name} Price in Nigeria?

The ${name} is priced at **${priceStr}** at Ogabassey with official HP ${specs.warranty}. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making it accessible for businesses, enterprises, and professionals seeking reliable ${isWorkstation ? 'workstation' : 'business'} performance.

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

    // Features section
    if (specs.features && specs.features.length > 0) {
        description += `\n## What Features Does the ${name} Have?\n\n`;
        description += specs.features.map(f => `- ✔️ ${f}`).join('\n');
    }

    // Business-specific section
    if (specs.category === 'business') {
        description += `

## Is the ${name} Good for Business Use?

The ${name} is designed for enterprise workloads with **${specs.processorGen} ${specs.processor}** performance, ${specs.features.includes('Fingerprint Reader') ? 'biometric security (fingerprint reader),' : ''} ${specs.features.includes('Backlit Keyboard') ? 'backlit keyboard for low-light work,' : ''} and durable construction built to HP's business standards. Ideal for IT deployments, remote work, and mobile productivity.
`;
    }

    // Workstation-specific section
    if (isWorkstation) {
        description += `

## Is the ${name} Good for Professional Work?

The ${name} Mobile Workstation is engineered for demanding professional applications including CAD, 3D rendering, video editing, and data science. Features **${specs.graphics}** ${specs.graphicsVram ? `(${specs.graphicsVram} dedicated)` : ''} graphics certified for professional software like Adobe Creative Suite, Autodesk, and SolidWorks.
`;
    }

    // Convertible section
    if (isConvertible) {
        description += `

## Is the ${name} a Touchscreen Laptop?

Yes, the ${name} features a **${specs.displaySize} ${specs.resolution} Touchscreen** display with 360° hinge for tablet mode. Perfect for presentations, note-taking with stylus, and executives who need versatility in client meetings and travel.
`;
    }

    // Why Buy section
    description += `

## Why Buy the ${name} from Ogabassey?

- ✅ **Enterprise Ready:** ${priceStr} with official HP warranty
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Brand New:** Sealed in box with HP ${specs.warranty}
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **IT Support:** Physical office in Ikeja for business after-sales service
- ✅ **Bulk Orders:** Contact us for enterprise volume discounts

## Related Products

- [HP EliteBook Series](/ogabassey/laptops/hp) - Premium Business
- [Dell Latitude](/ogabassey/laptops/dell) - Dell Alternative
- [Lenovo ThinkPad](/ogabassey/laptops/lenovo) - Lenovo Alternative
- [MacBook Pro](/ogabassey/macbook) - Apple Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// HP BUSINESS LAPTOPS DATA
// ------------------------------------------------------------------
const HP_BUSINESS_LAPTOPS: LaptopProduct[] = [
    // ProBook Series (Entry Business)
    {
        name: 'HP ProBook 450 G9',
        sku: '6A150EA',
        specs: {
            processor: 'Intel Core i3-1215U',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            display: 'FHD',
            displaySize: '15.6"',
            resolution: '1920x1080',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Sensor', 'Numeric Keypad', 'Business-grade']
        },
        cost_price: 567000,
        stock: 4
    },
    {
        name: 'HP ProBook 440 G8',
        sku: '2X7U5EA',
        specs: {
            processor: 'Intel Core i3-1115G4',
            processorGen: '11th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200 (2x4GB)',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            display: 'FHD',
            displaySize: '14"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Pike Silver Aluminum',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Reader', 'Backlit Keyboard', 'HD Webcam']
        },
        cost_price: 655000,
        stock: 15
    },
    {
        name: 'HP ProBook 460 G11 (Ultra 5)',
        sku: 'AD2G9ET#BH5',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'IPS Anti-glare',
            displaySize: '16"',
            resolution: '1920x1200 WUXGA',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Reader', 'Backlit Keyboard', 'Numeric Keypad', '16GB DDR5']
        },
        cost_price: 839000,
        stock: null
    },
    {
        name: 'HP ProBook 440 G11 (Ultra 5 8GB)',
        sku: '9Y7Q2ET',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '8GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Reader', 'Backlit Keyboard', 'Core Ultra 5']
        },
        cost_price: 863000,
        stock: null
    },
    {
        name: 'HP ProBook 440 G11 (Ultra 5 16GB)',
        sku: '9G1E7ET',
        specs: {
            processor: 'Intel Core Ultra 5 125U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'IPS',
            displaySize: '14"',
            resolution: '1920x1200 WUXGA',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Reader', 'Backlit Keyboard', '16GB RAM']
        },
        cost_price: 905000,
        stock: null
    },
    {
        name: 'HP ProBook 440 G11 (Ultra 7 512GB)',
        sku: '9G1W6ET',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Sensor', 'Backlit Keyboard', 'Core Ultra 7']
        },
        cost_price: 1032000,
        stock: null
    },
    {
        name: 'HP ProBook 440 14 inch G10',
        sku: '7L735ET',
        specs: {
            processor: 'Intel Core i7-1355U',
            processorGen: '13th Gen',
            ram: '8GB',
            ramType: 'DDR4-3200',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'FHD IPS',
            displaySize: '14"',
            resolution: '1920x1080',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Fingerprint Sensor', 'Core i7']
        },
        cost_price: 1040000,
        stock: 1
    },
    {
        name: 'HP ProBook 460 G11 (Ultra 7)',
        sku: 'AD2H0ET#BH5',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'IPS Anti-glare',
            displaySize: '16"',
            resolution: '1920x1200 WUXGA',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Sensor', 'Backlit Keyboard', '16" Display', 'Core Ultra 7']
        },
        cost_price: 1054000,
        stock: null
    },
    {
        name: 'HP ProBook 440 G11 (Ultra 7 1TB)',
        sku: 'AD0X9ET',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '1TB',
            storageType: 'PCIe NVMe SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Reader', 'Backlit Keyboard', '1TB Storage']
        },
        cost_price: 1085000,
        stock: null
    },
    {
        name: 'HP ProBook 440 G11 (Ultra 7 8GB)',
        sku: '9Y7Q1ET#BH5',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '8GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint', 'Backlit Keyboard']
        },
        cost_price: 1089000,
        stock: null
    },

    // EliteBook Series (Premium Business)
    {
        name: 'HP EliteBook 640 G11 (Ultra 5)',
        sku: 'A1NQ1UT#ABA',
        specs: {
            processor: 'Intel Core Ultra 5 135U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5',
            storage: '256GB',
            storageType: 'NVMe SSD',
            display: 'Standard',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Pike Silver',
            warranty: '1 Year HP Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'Windows 11 Pro']
        },
        cost_price: 1064000,
        stock: 1
    },
    {
        name: 'HP EliteBook 1040 G9 (i5)',
        sku: '6F683EA',
        specs: {
            processor: 'Intel Core i5-1235U',
            processorGen: '12th Gen',
            ram: '8GB',
            ramType: 'DDR5-4800 (Upgradable)',
            storage: '256GB',
            storageType: 'PCIe NVMe SSD',
            display: 'WUXGA IPS',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Sensor', 'Backlit Keyboard', 'Premium Build']
        },
        cost_price: 1109000,
        stock: 11
    },
    {
        name: 'HP ProBook 440 G11 (Ultra 7 16GB v2)',
        sku: '9G1W6ET#BH5',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS 3.0',
            color: 'Pike Silver',
            warranty: '1 Year Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Sensor', 'Backlit Keyboard']
        },
        cost_price: 1154000,
        stock: null
    },
    {
        name: 'HP EliteBook 660 G11 (RTX 2050)',
        sku: 'C3YQ8U8#ABA',
        specs: {
            processor: 'Intel Core Ultra 5 125H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'NVMe SSD',
            display: 'Standard',
            displaySize: '16"',
            resolution: '1920x1200',
            graphics: 'NVIDIA RTX 2050',
            graphicsType: 'dedicated',
            graphicsVram: '4GB',
            os: 'Windows 11 Pro',
            color: 'Pike Silver',
            warranty: '1 Year HP Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Dedicated GPU', 'Windows 11 Pro', '16" Display']
        },
        cost_price: 1284000,
        stock: 2
    },
    {
        name: 'HP EliteBook 640 G11 (Ultra 7 32GB)',
        sku: 'AD1A2ET',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'DDR5-5600',
            storage: '1TB',
            storageType: 'PCIe Gen4 NVMe TLC M.2 SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Pike Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Reader', 'Backlit Keyboard', '32GB RAM', '1TB SSD']
        },
        cost_price: 1310000,
        stock: null
    },
    {
        name: 'HP EliteBook 840 G9 (i7 32GB)',
        sku: 'A1XS8U8#ABA',
        specs: {
            processor: 'Intel Core i7-1265U',
            processorGen: '12th Gen',
            ram: '32GB',
            ramType: 'DDR5-4800',
            storage: '256GB',
            storageType: 'NVMe SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Fingerprint Reader', 'Backlit Keyboard', '32GB RAM', 'NO WEBCAM']
        },
        cost_price: 1311000,
        stock: 3
    },
    {
        name: 'HP EliteBook 840 G11 (Ultra 7 32GB)',
        sku: 'AH9W8UC#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 135H',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'DDR5',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'Intel Arc', '32GB RAM']
        },
        cost_price: 1410000,
        stock: 2
    },
    {
        name: 'HP EliteBook 840 G11 (Ultra 7 16GB)',
        sku: 'A36XTET',
        specs: {
            processor: 'Intel Core Ultra 7 155U',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe NVMe M.2 SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'FreeDOS',
            color: 'Silver',
            warranty: '1 Year Channel Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'Core Ultra 7']
        },
        cost_price: 1557000,
        stock: null
    },
    {
        name: 'HP EliteBook 840 G10 (i7 32GB 1TB)',
        sku: 'B17T1UA#ABA',
        specs: {
            processor: 'Intel Core i7-1355U',
            processorGen: '13th Gen',
            ram: '32GB',
            ramType: 'DDR5',
            storage: '1TB',
            storageType: 'NVMe M.2 SSD',
            display: 'WUXGA IPS Anti-glare',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Iris Xe Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'business',
            type: 'laptop',
            features: ['Backlit Keyboard', '32GB RAM', '1TB SSD', 'Thin Bezel']
        },
        cost_price: 1678000,
        stock: 12
    },
    {
        name: 'HP EliteBook x360 1040 G11 (Ultra 7)',
        sku: 'A6SV3UT#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 155H',
            processorGen: 'Meteor Lake',
            ram: '16GB',
            ramType: 'LPDDR5x',
            storage: '512GB',
            storageType: 'PCIe 4.0x4 SSD',
            display: 'WUXGA Touchscreen',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'business',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'HP Rechargeable Active Pen', '360° Hinge']
        },
        cost_price: 1789000,
        stock: 2
    },
    {
        name: 'HP EliteBook x360 1040 G10',
        sku: 'A38N2US#ABA',
        specs: {
            processor: 'Intel Core i7-1365U',
            processorGen: '13th Gen',
            ram: '32GB',
            ramType: 'LPDDR5-4800',
            storage: '256GB',
            storageType: 'SSD',
            display: 'WUXGA Touchscreen',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel UHD Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Natural Silver',
            warranty: '1 Year HP Warranty',
            category: 'business',
            type: 'convertible',
            features: ['Backlit Keyboard', 'Webcam', '32GB RAM', '360° Hinge']
        },
        cost_price: 2083000,
        stock: 1
    },
    {
        name: 'HP EliteBook x360 1040 G11 (3yr)',
        sku: '8Y1P9AV',
        specs: {
            processor: 'Intel Core Ultra 7 155H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'LPDDR5x-7500 (onboard)',
            storage: '512GB',
            storageType: 'PCIe NVMe SSD',
            display: 'WUXGA Touchscreen',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Arc Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Natural Silver',
            warranty: '3 Years Channel Warranty',
            category: 'business',
            type: 'convertible',
            features: ['Fingerprint Reader', 'Backlit Keyboard', 'Intel Arc', '3 Year Warranty']
        },
        cost_price: 2320000,
        stock: 0,
        soldOut: true
    },

    // ZBook Workstation Series
    {
        name: 'HP ZBook Firefly G11 (Ultra 7 165H)',
        sku: 'A6UK9UT#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 165H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5',
            storage: '512GB',
            storageType: 'PCIe 4.0 SSD',
            display: 'IPS',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'workstation',
            type: 'workstation',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'Mobile Workstation']
        },
        cost_price: 1468000,
        stock: 15
    },
    {
        name: 'HP ZBook Firefly 14 G11 (Ultra 7 165U 32GB)',
        sku: 'A6UK7UT#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 165U',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'DDR5',
            storage: '1TB',
            storageType: 'PCIe 4.0 SSD',
            display: 'WUXGA',
            displaySize: '14"',
            resolution: '1920x1200',
            graphics: 'Intel Graphics',
            graphicsType: 'integrated',
            os: 'Windows 11 Pro',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'workstation',
            type: 'workstation',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'IR Webcam', '32GB RAM', '1TB SSD']
        },
        cost_price: 1711000,
        stock: 15
    },
    {
        name: 'HP ZBook Power G11 (RTX 1000 Ada)',
        sku: 'A6UQ4UT#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 155H',
            processorGen: '14th Gen',
            ram: '16GB',
            ramType: 'DDR5-5600',
            storage: '512GB',
            storageType: 'PCIe Gen4 NVMe TLC M.2 SSD',
            display: 'IPS Anti-glare',
            displaySize: '16"',
            resolution: '1920x1200 WUXGA',
            graphics: 'NVIDIA RTX 1000 Ada Generation',
            graphicsType: 'dedicated',
            graphicsVram: '6GB GDDR6',
            os: 'Windows 11 Pro',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'workstation',
            type: 'workstation',
            features: ['Backlit Keyboard', 'Fingerprint Sensor', 'RTX 1000 Ada', 'Professional Graphics']
        },
        cost_price: 1772000,
        stock: 1
    },
    {
        name: 'HP ZBook Firefly 14 G11 (RTX A500)',
        sku: 'A6UK1UT#ABA',
        specs: {
            processor: 'Intel Core Ultra 7 155H',
            processorGen: '14th Gen',
            ram: '32GB',
            ramType: 'DDR5-5600',
            storage: '1TB',
            storageType: 'PCIe Gen4 NVMe TLC M.2 SSD',
            display: 'IPS',
            displaySize: '14"',
            resolution: '1920x1200 WUXGA',
            graphics: 'NVIDIA RTX A500',
            graphicsType: 'dedicated',
            graphicsVram: '4GB GDDR6',
            os: 'Windows 11 Pro',
            color: 'Silver',
            warranty: '1 Year HP Warranty',
            category: 'workstation',
            type: 'workstation',
            features: ['Backlit Keyboard', 'Fingerprint Reader', 'IR Webcam', 'RTX A500', '32GB RAM']
        },
        cost_price: 1973000,
        stock: 24
    },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedHPBusinessLaptops() {
    console.log("💼 Starting HP Business Laptops Import (EAV v2)...\n");

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
        console.log("ℹ️  HP category not found, it should exist from consumer import");
    }
    const categoryId = hpCat?.id;

    // Seed Products
    console.log(`🌱 Seeding ${HP_BUSINESS_LAPTOPS.length} HP Business Laptops...\n`);

    let created = 0;
    let skipped = 0;
    let soldOut = 0;

    for (const product of HP_BUSINESS_LAPTOPS) {
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

    console.log(`\n🏁 HP Business Laptops Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped} | Sold Out: ${soldOut}`);
}

seedHPBusinessLaptops().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
