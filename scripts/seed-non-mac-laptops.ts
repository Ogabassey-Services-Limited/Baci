import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

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
// DATA PARSING UTIL
// ------------------------------------------------------------------

interface StructuredSpecs {
    Processor?: string;
    RAM?: string;
    Storage?: string;
    Display?: string;
    Graphics?: string;
    Other?: string;
}

function parseSpecs(specsString: string): StructuredSpecs {
    const parts = specsString.split(',').map(s => s.trim());
    const result: StructuredSpecs = {};

    parts.forEach(part => {
        const p = part.toLowerCase();
        if (p.includes('core') || p.includes('ryzen') || p.includes('pro') || p.includes('max') || p.match(/i\d/) || p.includes('snapdragon')) {
            if (!result.Processor) result.Processor = part;
            else result.Other = result.Other ? result.Other + ', ' + part : part;
        } else if (p.includes('ram')) {
            result.RAM = part;
        } else if (p.includes('ssd') || p.includes('hdd') || p.includes('storage')) {
            result.Storage = part;
        } else if (p.includes('"') || p.includes('inch') || p.includes('display') || p.includes('touch') || p.includes('fhd') || p.includes('qhd') || p.includes('4k')) {
            result.Display = part;
        } else if (p.includes('geforce') || p.includes('radeon') || p.includes('nvidia') || p.includes('quadro') || p.includes('graphics')) {
            result.Graphics = part;
        } else {
            result.Other = result.Other ? result.Other + ', ' + part : part;
        }
    });

    return result;
}

// ------------------------------------------------------------------
// DATA
// ------------------------------------------------------------------

const HP_PRODUCTS = [
    { name: 'HP Envy x360 2-in-1 14-es1023dx', specs: 'Intel Core 7 150U, 16GB RAM, 512GB SSD, 14" FHD Touch', price: 1150000, condition: 'New' },
    { name: 'HP Elite Dragonfly Chromebook', specs: '12th Gen Intel Core i5, 16GB RAM, 256GB SSD, 13.3" Touch', price: 380000, condition: 'Premium Used' },
    { name: 'HP EliteBook 830 G6 x360', specs: '8th Gen Intel Core i5, 8GB RAM, 256GB SSD, 13.3" Touch', price: 400000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G2', specs: '5th Gen Intel Core i5, 8GB RAM, 256GB SSD, 14" Touch', price: 225000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G3', specs: '5th Gen Intel Core i5, 8GB RAM, 256GB SSD, 14"', price: 235000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G3 (6th Gen)', specs: '6th Gen Intel Core i5, 8GB RAM, 256GB SSD, Touchscreen', price: 275000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G4', specs: '7th Gen Intel Core i7, 16GB RAM, 256GB SSD, 14" FHD', price: 280000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G8 (512GB)', specs: '11th Gen Intel Core i5, 16GB RAM, 512GB SSD, 14" Touch', price: 480000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G8 (256GB)', specs: '11th Gen Intel Core i5, 16GB RAM, 256GB SSD, 14" Touch', price: 470000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G7 (256GB Non-Touch)', specs: '10th Gen Intel Core i5, 16GB RAM, 256GB SSD, 14"', price: 400000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G7 (256GB Touch)', specs: '10th Gen Intel Core i5, 16GB RAM, 256GB SSD, 14" Touch', price: 430000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G7 (512GB Non-Touch)', specs: '10th Gen Intel Core i5, 16GB RAM, 512GB SSD, 14"', price: 410000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G7 (512GB Touch)', specs: '10th Gen Intel Core i5, 16GB RAM, 512GB SSD, 14" Touch', price: 440000, condition: 'Premium Used' },
    { name: 'HP EliteBook 840 G6', specs: '8th Gen Intel Core i5, 16GB RAM, 256GB SSD, 14"', price: 320000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1030 G2 x360 (i5/8/256)', specs: '7th Gen Intel Core i5, 8GB RAM, 256GB SSD, 13" FHD Touch', price: 390000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1030 G2 x360 (i5/8/512)', specs: '7th Gen Intel Core i5, 8GB RAM, 512GB SSD, 13" FHD Touch', price: 410000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1030 G2 x360 (i7/8/512)', specs: '7th Gen Intel Core i7, 8GB RAM, 512GB SSD, 13" FHD Touch', price: 470000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1030 G3 x360 (i5)', specs: '8th Gen Intel Core i5, 8GB RAM, 256GB SSD, 13" FHD Touch', price: 400000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1030 G3 x360 (i7/16/256)', specs: '8th Gen Intel Core i7, 16GB RAM, 256GB SSD, 13" FHD Touch', price: 470000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1030 G3 x360 (i7/16/512)', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 13" FHD Touch', price: 490000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1030 G4 x360', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 13" FHD Touch', price: 500000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G6 x360 (16/256)', specs: '8th Gen Intel Core i7, 16GB RAM, 256GB SSD, 14" FHD Touch', price: 510000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G6 x360 (16/512)', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 14" FHD Touch', price: 530000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G6 x360 (32/512)', specs: '8th Gen Intel Core i7, 32GB RAM, 512GB SSD, 14" FHD Touch', price: 550000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1030 G7 x360', specs: '10th Gen Intel Core i7, 32GB RAM, 512GB SSD, 13" FHD Touch', price: 620000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G7 x360 (16/256)', specs: '10th Gen Intel Core i7, 16GB RAM, 256GB SSD, 14" FHD Touch', price: 550000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G7 x360 (16/512)', specs: '10th Gen Intel Core i7, 16GB RAM, 512GB SSD, 14" FHD Touch', price: 580000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G7 x360 (32/512)', specs: '10th Gen Intel Core i7, 32GB RAM, 512GB SSD, 14" FHD Touch', price: 620000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G7 x360 (32/1TB)', specs: '10th Gen Intel Core i7, 32GB RAM, 1TB SSD, 14" FHD Touch', price: 660000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G8', specs: '11th Gen Intel Core i5, 16GB RAM, 256GB SSD, 14" Touch', price: 600000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G8 x360 (16/512)', specs: '11th Gen Intel Core i7, 16GB RAM, 512GB SSD, 14" FHD Touch', price: 650000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G8 x360 (32/512)', specs: '11th Gen Intel Core i7, 32GB RAM, 512GB SSD, 14" FHD Touch', price: 700000, condition: 'Premium Used' },
    { name: 'HP EliteBook 1040 G8 x360 (32/1TB)', specs: '11th Gen Intel Core i7, 32GB RAM, 1TB SSD, 14" FHD Touch', price: 740000, condition: 'Premium Used' },
    { name: 'HP Pavilion 15', specs: '10th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15" FHD Touch, Nvidia MX250', price: 620000, condition: 'Premium Used' },
    { name: 'HP Spectre 13-ae0xx x360', specs: '8th Gen Intel Core i7, 16GB RAM, 1TB SSD, 13" FHD Touch', price: 650000, condition: 'Premium Used' },
    { name: 'HP Spectre 13-ap0xxx Gem Cut', specs: '8th Gen Intel Core i7, 16GB RAM, 1TB SSD, 13" FHD Touch', price: 750000, condition: 'Premium Used' },
    { name: 'HP Spectre 15 x360 Gem Cut 4K', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15" 4K UHD Touch, GTX 1050Ti', price: 880000, condition: 'Premium Used' },
    { name: 'HP ZBook 15u G6', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15.6" FHD Touch, AMD Radeon WX3200', price: 620000, condition: 'Premium Used' },
    { name: 'HP ZBook 15 G6', specs: '9th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15.6" FHD, Nvidia Quadro T1000', price: 660000, condition: 'Premium Used' },
    { name: 'HP ZBook Studio 15 G5 (P1000/680k)', specs: '8th Gen Intel Core i7, 32GB RAM, 1TB SSD, 15.6" FHD, Quadro P1000', price: 680000, condition: 'Premium Used' },
    { name: 'HP ZBook Studio 15 G5 (P1000/740k)', specs: '8th Gen Intel Core i7, 32GB RAM, 1TB SSD, 15.6" FHD, Quadro P1000', price: 740000, condition: 'Premium Used' },
];

const DELL_PRODUCTS = [
    { name: 'Dell XPS 13 9365 2-in-1', specs: '8th Gen Intel Core i7, 16GB RAM, 256GB SSD, 13.3" QHD+ Touch', price: 525000, condition: 'Premium Used' },
    { name: 'Dell XPS 15 9560', specs: '7th Gen Intel Core i7, 16GB RAM, 256GB SSD, 15" FHD Touch, GTX 1050', price: 450000, condition: 'Premium Used' },
    { name: 'Dell XPS 15 9530', specs: '13th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15"', price: 1350000, condition: 'Premium Used' },
    { name: 'Dell XPS 15 9520', specs: '12th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15", RTX 3050', price: 1200000, condition: 'Premium Used' },
    { name: 'Dell XPS 15 7590', specs: '9th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15.6", GTX 1650', price: 750000, condition: 'Premium Used' },
    { name: 'Dell XPS 15 9570', specs: '8th Gen Intel Core i5, 16GB RAM, 256GB SSD, GTX 1050', price: 570000, condition: 'Premium Used' },
    { name: 'Dell XPS 13 9360', specs: '8th Gen Intel Core i5, 16GB RAM, 256GB SSD, Touch', price: 450000, condition: 'Premium Used' },
    { name: 'Dell XPS 13 9365 (i7)', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 13" FHD Touch', price: 450000, condition: 'Premium Used' },
    { name: 'Dell XPS 13 9380', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 13.3"', price: 490000, condition: 'Premium Used' },
    { name: 'Dell XPS 13 9365 (i5)', specs: '7th Gen Intel Core i5, 8GB RAM, 256GB SSD, 13.3" QHD+ Touch', price: 380000, condition: 'Premium Used' },
    { name: 'Dell XPS 15 9560 (512GB)', specs: '7th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15.6" FHD, GTX 1050', price: 620000, condition: 'Premium Used' },
    { name: 'Dell Vostro 5490', specs: '10th Gen Intel Core i7, 12GB RAM, 512GB SSD, 14" FHD, 2GB Nvidia', price: 550000, condition: 'Premium Used' },
    { name: 'Dell Vostro 5481', specs: '8th Gen Intel Core i7, 8GB RAM, 256GB SSD, 14" FHD', price: 400000, condition: 'Premium Used' },
    { name: 'Dell Inspiron 15 7567 Gaming', specs: '7th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15" FHD, GTX 1050Ti', price: 580000, condition: 'Premium Used' },
    { name: 'Dell Precision 3571', specs: '12th Gen Intel Core i5, 16GB RAM, 256GB SSD, 15" FHD Touch, 4GB Graphics', price: 620000, condition: 'Premium Used' },
    { name: 'Dell Precision 3570 (512GB)', specs: '12th Gen Intel Core i5, 16GB RAM, 512GB SSD, 15" FHD, 4GB Graphics', price: 640000, condition: 'Premium Used' },
    { name: 'Dell Precision 3570 (256GB)', specs: '12th Gen Intel Core i5, 16GB RAM, 256GB SSD, 15" FHD, 4GB Graphics', price: 610000, condition: 'Premium Used' },
    { name: 'Dell Precision 3470', specs: '12th Gen Intel Core i5, 8GB RAM, 256GB SSD, 14" FHD', price: 500000, condition: 'Premium Used' },
    { name: 'Dell Precision 5520', specs: '7th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15.6" 4K Touch, Quadro M1200M', price: 660000, condition: 'Premium Used' },
    { name: 'Dell Precision 5530 (FHD)', specs: 'Intel Core i7-8850H, 16GB RAM, 512GB SSD, 15.6" FHD, Quadro P1000', price: 650000, condition: 'Premium Used' },
    { name: 'Dell Precision 5530 (4K)', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 15.6" 4K Touch, Quadro P1000', price: 680000, condition: 'Premium Used' },
    { name: 'Dell Precision 5530 (i9)', specs: '8th Gen Intel Core i9, 16GB RAM, 512GB SSD, 15" FHD, Quadro P2000', price: 740000, condition: 'Premium Used' },
    { name: 'Dell Precision 5550', specs: '10th Gen Intel Core i5 vPro, 32GB RAM, 512GB SSD, 15.6" 4K Touch, Quadro T1000', price: 770000, condition: 'Premium Used' },
    { name: 'Dell Inspiron 16 5620', specs: '12th Gen Intel Core i7, 16GB RAM, 512GB SSD, 16" FHD', price: 600000, condition: 'Premium Used' },
    { name: 'Dell Inspiron 15 3000', specs: '11th Gen Intel Core i3, 8GB RAM, 256GB SSD, 14" FHD Touch', price: 380000, condition: 'Premium Used' },
    { name: 'Dell Inspiron 7348', specs: '5th Gen Intel Core i3, 8GB RAM, 500GB HDD, 13" FHD Touch', price: 200000, condition: 'Premium Used' },
    { name: 'Dell Inspiron 15 5510', specs: '11th Gen Intel Core i5, 8GB RAM, 256GB SSD, 16" FHD', price: 450000, condition: 'Premium Used' },
    { name: 'Dell Inspiron 15 5000', specs: '8th Gen Intel Core i7, 8GB RAM, 256GB SSD, 15" FHD', price: 420000, condition: 'Premium Used' },
    { name: 'Dell Latitude 3400', specs: '8th Gen Intel Core i5, 8GB RAM, 512GB SSD, 14" FHD', price: 280000, condition: 'Premium Used' },
    { name: 'Dell Latitude 3410 (256GB)', specs: '10th Gen Intel Core i5, 8GB RAM, 256GB SSD, 14" FHD', price: 380000, condition: 'Premium Used' },
    { name: 'Dell Latitude 3410 (512GB)', specs: '10th Gen Intel Core i5, 8GB RAM, 512GB SSD, 14" FHD', price: 400000, condition: 'Premium Used' },
    { name: 'Dell Latitude 3420', specs: '11th Gen Intel Core i5, 8GB RAM, 256GB SSD, 14" FHD', price: 390000, condition: 'Premium Used' },
    { name: 'Dell Latitude 3510', specs: '10th Gen Intel Core i5, 8GB RAM, 256GB SSD, 15.6" FHD', price: 350000, condition: 'Premium Used' },
    { name: 'Dell Latitude 3520', specs: '11th Gen Intel Core i5, 8GB RAM, 256GB SSD, 15.6" FHD', price: 370000, condition: 'Premium Used' },
    { name: 'Dell Latitude 5300', specs: '8th Gen Intel Core i5, 8GB RAM, 256GB SSD, 13" FHD', price: 280000, condition: 'Premium Used' },
    { name: 'Dell Latitude 5300 2-in-1 (i7-8665U/256)', specs: '8th Gen Intel Core i7, 16GB RAM, 256GB SSD, 13" FHD Touch, FaceID', price: 390000, condition: 'Premium Used' },
    { name: 'Dell Latitude 5300 2-in-1 (i7-8665U/512)', specs: '8th Gen Intel Core i7, 16GB RAM, 512GB SSD, 13" FHD Touch, FaceID', price: 410000, condition: 'Premium Used' },
    { name: 'Dell Latitude 5300 2-in-1 (i5)', specs: '8th Gen Intel Core i5, 8GB RAM, 256GB SSD, 13" FHD Touch', price: 340000, condition: 'Premium Used' },
];

function generateDescription(product: any, specs: StructuredSpecs) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(product.price);
    const monthlyPayment = Math.ceil(product.price / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);
    const isUsed = product.condition === 'Premium Used';

    return `## What is the ${product.name} Price in Nigeria?

The **${product.name}** is priced at **${priceStr}** at Ogabassey with ${isUsed ? '90-day warranty' : 'official warranty'}. You can also pay **${bnplStr}/month for 10 months** via BNPL (Buy Now Pay Later), making premium ${product.brand} laptops accessible to Nigerian professionals.

## What are the ${product.name} Specifications?

| Specification | Value |
|---------------|-------|
| **Processor** | ${specs.Processor || 'Intel Core'} |
| **RAM** | ${specs.RAM || 'Standard'} |
| **Storage** | ${specs.Storage || 'SSD'} |
| **Display** | ${specs.Display || 'FHD'} |
| **Graphics** | ${specs.Graphics || 'Integrated Intel'} |
| **Condition** | ${product.condition} |
| **Brand** | ${product.brand} |

## What Condition is the ${product.name}?

${isUsed ? `This is a **Premium Used** laptop that has been professionally refurbished and certified. Every unit undergoes a rigorous 50-point inspection, battery health verification (80%+ guaranteed), and cosmetic grading (Grade A - minimal wear). You get enterprise-quality hardware at a fraction of new prices.` : `This is **Brand New** - sealed in original packaging with full manufacturer warranty. You receive the complete retail experience with all original accessories and documentation.`}

## Why Buy Premium Used Laptops from Ogabassey?

- ✅ **Best Value:** Enterprise-grade specs at 40-60% off new prices
- ✅ **Flexible Payment:** Pay **${bnplStr}/month × 10** via BNPL
- ✅ **Quality Guaranteed:** 50-point inspection + ${isUsed ? '90-day' : '1-year'} warranty
- ✅ **Fast Delivery:** Same-day in Lagos, 2-5 days nationwide
- ✅ **Support:** Physical office in Ikeja for after-sales service

## Related Products

- [HP EliteBook Series](/ogabassey/laptops) - Business Laptops
- [Dell XPS Series](/ogabassey/laptops) - Premium Ultrabooks
- [MacBook Pro](/ogabassey/macbook) - Apple Alternative
`.trim();
}

async function seed() {
    console.log("🌱 Seeding HP and Dell Laptops (RFC-compliant)...");

    // Get Laptops Category
    const { data: cat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'laptops').single();

    if (!cat) {
        console.error("❌ 'Laptops' category not found");
        return;
    }

    const allProducts = [
        ...HP_PRODUCTS.map(p => ({ ...p, brand: 'HP' })),
        ...DELL_PRODUCTS.map(p => ({ ...p, brand: 'Dell' }))
    ];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const p of allProducts) {
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const specs = parseSpecs(p.specs);

        // SEO/Frontend-friendly structured specs
        const structuredSpecs = [
            {
                category: 'Performance',
                items: [
                    { label: 'Processor', value: specs.Processor || 'Standard' },
                    { label: 'RAM', value: specs.RAM || 'Standard' },
                    { label: 'Graphics', value: specs.Graphics || 'Integrated' }
                ]
            },
            {
                category: 'Display & Design',
                items: [
                    { label: 'Display', value: specs.Display || 'Standard' },
                    { label: 'Storage', value: specs.Storage || 'Standard' }
                ]
            }
        ];

        const description = generateDescription(p, specs);

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id, metadata').eq('slug', slug).maybeSingle();

        const metadata = {
            brand: p.brand,
            model: p.name,
            condition: p.condition,
            // Enhanced EAV fields
            processor: specs.Processor,
            processorGen: specs.Processor?.match(/(\d+)(th|st|nd|rd)\s*Gen/i)?.[0] || '',
            ram: specs.RAM?.match(/\d+GB/i)?.[0] || specs.RAM,
            ramType: specs.RAM?.includes('DDR5') ? 'DDR5' : 'DDR4',
            storage: specs.Storage?.match(/\d+GB|\d+TB/i)?.[0] || specs.Storage,
            storageType: specs.Storage?.toLowerCase().includes('ssd') ? 'SSD' : specs.Storage?.toLowerCase().includes('hdd') ? 'HDD' : 'SSD',
            display: specs.Display,
            displaySize: specs.Display?.match(/\d+(\.\d+)?["']/)?.[0] || '14"',
            resolution: specs.Display?.includes('4K') ? '3840x2160' : specs.Display?.includes('QHD') ? '2560x1440' : '1920x1080',
            graphics: specs.Graphics || 'Intel Integrated',
            graphicsType: (specs.Graphics?.toLowerCase().includes('nvidia') || specs.Graphics?.toLowerCase().includes('radeon') || specs.Graphics?.toLowerCase().includes('quadro') || specs.Graphics?.toLowerCase().includes('gtx') || specs.Graphics?.toLowerCase().includes('rtx')) ? 'dedicated' : 'integrated',
            warranty: p.condition === 'Premium Used' ? '90-Day Ogabassey Warranty' : '1 Year Manufacturer Warranty',
            category: 'business',
            type: 'laptop',
            features: [
                specs.Display?.toLowerCase().includes('touch') ? 'Touchscreen' : null,
                specs.Display?.toLowerCase().includes('4k') ? '4K Display' : null,
                p.name.toLowerCase().includes('x360') || p.name.toLowerCase().includes('2-in-1') ? '2-in-1 Convertible' : null,
                p.condition === 'Premium Used' ? 'Certified Refurbished' : 'Brand New Sealed',
            ].filter(Boolean),
            // Legacy structured specs for frontend compatibility
            specifications: structuredSpecs,
        };

        if (existing) {
            // UPDATE if exists to fix metadata
            const { error: updateError } = await supabase.from('products').update({
                description: description,
                metadata: metadata,
                specifications: structuredSpecs as any // Populate explicit column if it exists in schema
            }).eq('id', existing.id);

            if (updateError) console.error(`❌ Update Failed ${p.name}:`, updateError.message);
            else {
                console.log("🔄 Updated (Metadata Fix):", p.name);
                updated++;
            }
        } else {
            // CREATE
            const { error } = await supabase.from('products').insert({
                name: `${p.name} (${p.condition})`,
                slug: slug,
                merchant_id: cat.merchant_id,
                price: p.price,
                cost_price: Math.round(p.price * 0.85),
                description: description,
                category: 'Laptops',
                metadata: metadata,
                specifications: structuredSpecs as any, // Populate explicit column
                status: 'active',
                stock: 2,
                condition: p.condition === 'New' ? 'new' : 'used',
                condition_detail: p.condition
            });

            if (error) {
                console.error(`❌ Failed ${p.name}:`, error.message);
            } else {
                console.log("✅ Created:", p.name);
                created++;
            }
        }
    }

    console.log("\n🏁 Done! Created:", created, ", Updated:", updated, ", Skipped:", skipped);
}

seed();
