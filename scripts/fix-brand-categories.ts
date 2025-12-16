
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const KNOWN_BRANDS = [
    'Samsung', 'Apple', 'Oppo', 'Vivo', 'Tecno', 'Infinix', 'Xiaomi', 'Redmi',
    'Asus', 'HP', 'Dell', 'Lenovo', 'Sony', 'Nintendo', 'Microsoft', 'Google',
    'Oraimo', 'JBL', 'Anker', 'Zealot', 'Itel', 'Nokia', 'Huawei', 'Realme'
];

type CategoryRule = {
    target: string;
    keywords: string[];
    priority: number; // Higher number = higher priority
};

const CATEGORY_RULES: CategoryRule[] = [
    {
        target: 'Smartphones',
        keywords: [
            'iPhone', 'Galaxy S', 'Galaxy A', 'Galaxy Z', 'Galaxy M', 'Galaxy F',
            'Redmi', 'Infinix', 'Tecno', 'Oppo', 'vivo', 'Pixel', 'Realme',
            'Hot', 'Smart', 'Spark', 'Pop', 'Camon', 'V30', 'V29', 'Y17', 'Y100',
            'Reno', 'Pova', 'Note 40', 'Note 30', 'Note 12', 'X68', 'Zero',
            'Phantom', 'A58', 'A34', 'A54', 'A14', 'A04', 'A05', 'S24', 'S23', 'S22',
            'itel', 'A70', 'P55', 'A18', 'A58'
        ],
        priority: 10
    },
    {
        target: 'Smartwatches',
        keywords: ['Watch', 'Band', 'Fitbit', 'Garmin', 'iWatch'],
        priority: 12 // Higher than Accessories
    },
    {
        target: 'Laptops',
        keywords: [
            'MacBook', 'ThinkPad', 'EliteBook', 'Latitude', 'ZenBook', 'Vivobook',
            'Aspire', 'Pavilion', 'Envy', 'Spectre', 'XPS', 'Alienware', 'Legion',
            'Omen', 'Rog', 'Tuf', 'Ideapad', 'Yoga', 'Vostro', 'ProBook', 'Notebook'
        ],
        priority: 10
    },
    {
        target: 'Tablets',
        keywords: ['iPad', 'Galaxy Tab', 'Tab', 'MatePad', 'Pad', 'Tablet'],
        priority: 12 // Higher than Smartphones (priority 10) so "Redmi Pad" becomes Tablet
    },
    {
        target: 'TVs',
        keywords: ['TV', 'QLED', 'OLED', 'UHD', 'Television', 'Smart TV', '4K'],
        priority: 10
    },
    {
        target: 'Audio',
        keywords: [
            'Buds', 'AirPods', 'Speaker', 'JBL', 'Headset', 'Headphone', 'Earphone',
            'Soundbar', 'Boombox', 'PartyBox', 'Clip', 'Flip', 'Charge', 'Go 3', 'Go 4'
        ],
        priority: 10
    },
    {
        target: 'Gaming Consoles',
        keywords: ['PlayStation', 'Xbox', 'Nintendo', 'Switch', 'Console', 'PS5', 'PS4', 'Series X', 'Series S'],
        priority: 15 // Check this before Accessories
    },
    {
        target: 'Accessories',
        keywords: [
            'Case', 'Cover', 'Charger', 'Cable', 'Adapter', 'Protector', 'Screen',
            'Power Bank', 'Stand', 'Mount', 'Holder', 'Strap', 'Band', 'Pencil', 'Pen'
        ],
        priority: 5 // Lower priority, let specific items match first if possible
    },
    {
        target: 'Smart From Home',
        keywords: ['Hub', 'Doorbell', 'Camera', 'Lock', 'Plug', 'Light', 'Bulb'],
        priority: 10
    }
];

// Helper to determine category from name
function determineCategory(name: string): string | null {
    const lowerName = name.toLowerCase();

    // Find matching rules
    const matches = CATEGORY_RULES.filter(rule =>
        rule.keywords.some(k => lowerName.includes(k.toLowerCase()))
    );

    if (matches.length === 0) return null;

    // Return the one with highest priority
    matches.sort((a, b) => b.priority - a.priority);
    return matches[0].target;
}

async function fixBrandCategories() {
    console.log('🔧 Fixing Brand-as-Category Issues...\n');

    // 1. Get products where category is in known brands list OR category equals brand column
    // We'll fetch a broad set and filter in JS to be safe
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, brand, category')
        .neq('status', 'archived');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    let updates: { id: string, name: string, oldCat: string, newCat: string }[] = [];
    let skipped: { id: string, name: string, category: string }[] = [];

    for (const p of products || []) {
        const currentCat = p.category;
        const brand = p.brand;

        // Check if category is problematic
        const isBrandAsCat =
            (currentCat && currentCat === brand) ||
            (currentCat && KNOWN_BRANDS.includes(currentCat));

        if (isBrandAsCat) {
            const newCat = determineCategory(p.name);

            if (newCat && newCat !== currentCat) {
                updates.push({
                    id: p.id,
                    name: p.name,
                    oldCat: currentCat,
                    newCat: newCat
                });
            } else {
                skipped.push({ id: p.id, name: p.name, category: currentCat });
            }
        }
    }

    console.log(`Found ${updates.length} products to map.`);
    console.log(`Found ${skipped.length} products that could not be automatically mapped (ambiguous).\n`);

    // Execute Updates
    for (const update of updates) {
        console.log(`Updating: [${update.oldCat}] -> [${update.newCat}] : ${update.name}`);

        const { error } = await supabase
            .from('products')
            .update({ category: update.newCat })
            .eq('id', update.id);

        if (error) {
            console.error(`  ❌ Failed to update ${update.name}:`, error.message);
        }
    }

    if (skipped.length > 0) {
        console.log('\n⚠️ SKIPPED ITEMS (Manual Review Needed):');
        skipped.forEach(s => console.log(`  [${s.category}] ${s.name}`));
    }
}

fixBrandCategories().catch(console.error);
