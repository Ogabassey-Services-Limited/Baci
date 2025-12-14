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

// SEO data for each category
const CATEGORY_SEO: Record<string, { seo_heading: string; seo_description: string; description: string }> = {
    // Root Categories
    'laptops': {
        seo_heading: 'Buy Laptops in Nigeria - HP, Dell, Lenovo, MacBook & More | Ogabassey',
        seo_description: 'Shop laptops at best prices in Nigeria. Discover HP, Dell, Lenovo, MSI, Asus gaming laptops, and MacBooks. Brand new and premium used with warranty. BNPL available.',
        description: 'Explore our extensive collection of laptops from top brands including HP, Dell, Lenovo, MSI, Asus, and Apple MacBook. Both brand new and certified premium used options available.',
    },
    'smartphones': {
        seo_heading: 'Buy Smartphones in Nigeria - iPhone, Samsung, Tecno, Infinix | Ogabassey',
        seo_description: 'Shop smartphones at best prices in Nigeria. Discover iPhone, Samsung Galaxy, Tecno, Infinix, Redmi, and more. Brand new and premium used with warranty. BNPL available.',
        description: 'Discover the latest smartphones from Apple iPhone, Samsung Galaxy, Tecno, Infinix, Redmi, Oppo, and more. All phones come with warranty and flexible payment options.',
    },
    'tablets': {
        seo_heading: 'Buy Tablets in Nigeria - iPad, Samsung Tab, Tecno Pad | Ogabassey',
        seo_description: 'Shop tablets at best prices in Nigeria. Discover Apple iPad, Samsung Galaxy Tab, and Android tablets. Brand new with official warranty. BNPL available.',
        description: 'Browse our collection of tablets including Apple iPad, iPad Pro, iPad Air, Samsung Galaxy Tab, and Android tablets from leading brands.',
    },
    'macbook': {
        seo_heading: 'Buy MacBook in Nigeria - MacBook Air, MacBook Pro M1/M2/M3 | Ogabassey',
        seo_description: 'Shop MacBook at best prices in Nigeria. Discover MacBook Air M1/M2/M3, MacBook Pro 14" and 16" with M2 Pro/Max and M3. Brand new and certified used with warranty.',
        description: 'Explore Apple MacBook laptops including MacBook Air with M1, M2, and M3 chips, plus MacBook Pro 14" and 16" with Apple Silicon for maximum performance.',
    },
    'desktops': {
        seo_heading: 'Buy Desktop Computers in Nigeria - HP, Dell Business PCs | Ogabassey',
        seo_description: 'Shop desktop computers at best prices in Nigeria. Discover HP Pro Tower, Pro SFF, ProDesk, EliteDesk, iMac, and Mac Mini. Brand new with warranty.',
        description: 'Shop business desktop computers from HP and Apple. Perfect for offices, schools, and enterprises. Easy to service and upgrade.',
    },
    'monitors': {
        seo_heading: 'Buy Monitors in Nigeria - HP, Dell, Samsung Displays | Ogabassey',
        seo_description: 'Shop monitors at best prices in Nigeria. Discover HP P-Series, E-Series, OMEN gaming monitors. FHD, QHD, 4K displays. Brand new with warranty.',
        description: 'Professional monitors for work and gaming. Business displays, gaming monitors with high refresh rates, and USB-C docking solutions.',
    },
    'printers': {
        seo_heading: 'Buy Printers in Nigeria - HP LaserJet, Smart Tank, DeskJet | Ogabassey',
        seo_description: 'Shop printers at best prices in Nigeria. Discover HP LaserJet for business, Smart Tank for high volume, DeskJet for home. Brand new with warranty.',
        description: 'Professional printing solutions from HP. LaserJet for business, Smart Tank for high-volume low-cost printing, and DeskJet for home use.',
    },
    'gaming': {
        seo_heading: 'Buy Gaming Products in Nigeria - PS5, Xbox, Switch, Games | Ogabassey',
        seo_description: 'Shop gaming products at best prices in Nigeria. PlayStation 5, Xbox Series X/S, Nintendo Switch, games, controllers, and accessories. Brand new with warranty.',
        description: 'Gaming consoles, games, and accessories. PlayStation 5, Xbox Series X/S, Nintendo Switch, and more for the ultimate gaming experience.',
    },
    'audio': {
        seo_heading: 'Buy Audio Products in Nigeria - AirPods, Sony, JBL Headphones | Ogabassey',
        seo_description: 'Shop audio products at best prices in Nigeria. Apple AirPods, Sony headphones, JBL speakers, and wireless earbuds. Brand new with warranty.',
        description: 'Premium audio products including Apple AirPods, wireless headphones, Bluetooth speakers, and soundbars from leading brands.',
    },
    'accessories': {
        seo_heading: 'Buy Phone & Laptop Accessories in Nigeria - Cases, Chargers | Ogabassey',
        seo_description: 'Shop accessories at best prices in Nigeria. Phone cases, laptop bags, chargers, cables, screen protectors, and more. Fast delivery nationwide.',
        description: 'Essential accessories for your devices. Phone cases, laptop bags, chargers, cables, power banks, and protective accessories.',
    },
    'smart-tvs': {
        seo_heading: 'Buy Smart TVs in Nigeria - Samsung, LG, Sony 4K TVs | Ogabassey',
        seo_description: 'Shop smart TVs at best prices in Nigeria. Samsung QLED, LG OLED, Sony Bravia 4K TVs. All sizes from 32" to 85". Brand new with warranty.',
        description: 'Smart TVs from Samsung, LG, Sony, and more. 4K UHD, QLED, OLED displays in all sizes. Perfect for home entertainment.',
    },
    // Laptop Brand Sub-categories
    'hp': {
        seo_heading: 'Buy HP Laptops in Nigeria - ProBook, EliteBook, OMEN, Victus | Ogabassey',
        seo_description: 'Shop HP laptops at best prices in Nigeria. Discover HP ProBook, EliteBook, ZBook, OMEN gaming, and Victus. Brand new with official HP warranty.',
        description: 'HP laptops for every need. ProBook and EliteBook for business, ZBook for creative professionals, OMEN and Victus for gaming.',
    },
    'dell': {
        seo_heading: 'Buy Dell Laptops in Nigeria - XPS, Latitude, Alienware, Vostro | Ogabassey',
        seo_description: 'Shop Dell laptops at best prices in Nigeria. Discover Dell XPS premium, Latitude business, Alienware gaming, and Vostro. Brand new with Dell warranty.',
        description: 'Dell laptops for home and business. XPS for premium ultrabooks, Latitude for enterprise, Alienware for ultimate gaming.',
    },
    'lenovo': {
        seo_heading: 'Buy Lenovo Laptops in Nigeria - ThinkPad, IdeaPad, Legion | Ogabassey',
        seo_description: 'Shop Lenovo laptops at best prices in Nigeria. Discover ThinkPad business, IdeaPad consumer, Yoga premium, Legion gaming. Brand new with Lenovo warranty.',
        description: 'Lenovo laptops for every use case. ThinkPad for business reliability, Legion for gaming performance, Yoga for premium 2-in-1 experience.',
    },
    'msi': {
        seo_heading: 'Buy MSI Gaming Laptops in Nigeria - Titan, Raider, Katana | Ogabassey',
        seo_description: 'Shop MSI gaming laptops at best prices in Nigeria. Discover MSI Titan, Raider, Katana with RTX 4080/4090 graphics. Brand new with 2-year warranty.',
        description: 'MSI gaming laptops with the latest NVIDIA RTX graphics. Titan for desktop-class power, Raider for enthusiasts, Katana for competitive gaming.',
    },
    'asus': {
        seo_heading: 'Buy Asus ROG Gaming Laptops in Nigeria - Strix, Zephyrus, TUF | Ogabassey',
        seo_description: 'Shop Asus ROG gaming laptops at best prices in Nigeria. Discover ROG Strix, ROG Zephyrus with OLED, TUF Gaming. Brand new with 2-year warranty.',
        description: 'Asus Republic of Gamers (ROG) laptops. ROG Zephyrus for slim gaming, ROG Strix for performance, TUF Gaming for durability.',
    },
    'gaming-laptops': {
        seo_heading: 'Buy Gaming Laptops in Nigeria - RTX 4090/4080/4070 Laptops | Ogabassey',
        seo_description: 'Shop gaming laptops at best prices in Nigeria. HP OMEN, Dell Alienware, Lenovo Legion, MSI, Asus ROG with RTX 4090/4080. Brand new with warranty.',
        description: 'High-performance gaming laptops with the latest NVIDIA RTX graphics. From budget RTX 3050 to ultimate RTX 4090 desktop replacements.',
    },
    // Smartphone Brand Sub-categories
    'iphone': {
        seo_heading: 'Buy iPhone in Nigeria - iPhone 15 Pro Max, iPhone 14, SE | Ogabassey',
        seo_description: 'Shop iPhone at best prices in Nigeria. iPhone 15 Pro Max, iPhone 15, iPhone 14, iPhone SE. Brand new and certified used with Apple warranty.',
        description: 'Apple iPhone smartphones. Latest iPhone 15 series with A17 Pro chip, iPhone 14, and affordable iPhone SE options.',
    },
    'samsung': {
        seo_heading: 'Buy Samsung Phones in Nigeria - Galaxy S24, Z Fold 5, A Series | Ogabassey',
        seo_description: 'Shop Samsung phones at best prices in Nigeria. Galaxy S24 Ultra, Galaxy Z Fold 5, Galaxy A series. Brand new with Samsung warranty.',
        description: 'Samsung Galaxy smartphones. Flagship S24 series, innovative Z Fold and Flip, and affordable A series for every budget.',
    },
    'tecno': {
        seo_heading: 'Buy Tecno Phones in Nigeria - Camon, Phantom, Spark Series | Ogabassey',
        seo_description: 'Shop Tecno phones at best prices in Nigeria. Tecno Camon 20, Phantom X2, Spark 10. Brand new with official Tecno warranty. BNPL available.',
        description: 'Tecno smartphones for value-conscious buyers. Camon for camera enthusiasts, Phantom for flagship experience, Spark for everyday use.',
    },
    'infinix': {
        seo_heading: 'Buy Infinix Phones in Nigeria - Note, Hot, Zero Series | Ogabassey',
        seo_description: 'Shop Infinix phones at best prices in Nigeria. Infinix Note, Hot, Zero series with fast charging and big batteries. Brand new with warranty.',
        description: 'Infinix smartphones with powerful batteries and fast charging. Note series for productivity, Hot series for budget-friendly performance.',
    },
    'redmi': {
        seo_heading: 'Buy Redmi Phones in Nigeria - Redmi Note, POCO, Xiaomi | Ogabassey',
        seo_description: 'Shop Redmi phones at best prices in Nigeria. Redmi Note 13, POCO X5, Xiaomi smartphones. Flagship features at mid-range prices.',
        description: 'Xiaomi Redmi and POCO smartphones. Flagship specifications at affordable prices. Great value for camera, gaming, and everyday use.',
    },
    // Additional Categories
    'general': {
        seo_heading: 'Shop Electronics in Nigeria - Phones, Laptops, TVs | Ogabassey',
        seo_description: 'Shop electronics at best prices in Nigeria. Smartphones, laptops, tablets, TVs, gaming, and accessories. Brand new with warranty. BNPL available.',
        description: 'Discover all electronics and gadgets at Ogabassey. Premium quality products with flexible payment options.',
    },
    'wearables': {
        seo_heading: 'Buy Smartwatches in Nigeria - Apple Watch, Samsung Galaxy Watch | Ogabassey',
        seo_description: 'Shop smartwatches at best prices in Nigeria. Apple Watch Ultra, Galaxy Watch, fitness trackers. Brand new with warranty.',
        description: 'Smartwatches and fitness trackers from Apple, Samsung, and more. Track health, receive notifications, and stay connected.',
    },
    'apple': {
        seo_heading: 'Buy Apple Products in Nigeria - iPhone, MacBook, iPad, Watch | Ogabassey',
        seo_description: 'Shop Apple products at best prices in Nigeria. iPhone, MacBook, iPad, Apple Watch, AirPods. Brand new and certified used with warranty.',
        description: 'Complete Apple ecosystem. iPhone, MacBook, iPad, Apple Watch, AirPods, and Apple accessories.',
    },
    'google': {
        seo_heading: 'Buy Google Pixel Phones in Nigeria - Pixel 8 Pro, Pixel 7a | Ogabassey',
        seo_description: 'Shop Google Pixel phones at best prices in Nigeria. Pixel 8 Pro with Tensor G3, Pixel 7a. Pure Android with AI features.',
        description: 'Google Pixel smartphones with the purest Android experience. AI-powered camera, security updates, and Tensor chip.',
    },
    'itel': {
        seo_heading: 'Buy itel Phones in Nigeria - Budget Smartphones | Ogabassey',
        seo_description: 'Shop itel phones at best prices in Nigeria. Budget-friendly smartphones with big batteries and essential features.',
        description: 'itel smartphones for budget-conscious buyers. Affordable phones with essential features and reliable performance.',
    },
    'vivo': {
        seo_heading: 'Buy Vivo Phones in Nigeria - Camera Focused Smartphones | Ogabassey',
        seo_description: 'Shop Vivo phones at best prices in Nigeria. Camera-focused smartphones with innovative features and sleek designs.',
        description: 'Vivo smartphones with innovative camera technology. Professional-grade photography and stylish design.',
    },
    'oppo-phones': {
        seo_heading: 'Buy Oppo Phones in Nigeria - Find, Reno Series | Ogabassey',
        seo_description: 'Shop Oppo phones at best prices in Nigeria. Find X6 Pro, Reno series with fast charging and excellent cameras.',
        description: 'Oppo smartphones with SuperVOOC fast charging and AI camera systems. Premium quality at competitive prices.',
    },
    // Gaming Subcategories
    'playstation-5': {
        seo_heading: 'Buy PlayStation 5 in Nigeria - PS5 Console, Games, Accessories | Ogabassey',
        seo_description: 'Shop PlayStation 5 at best prices in Nigeria. PS5 Standard and Digital Edition, DualSense controllers, PS5 games.',
        description: 'PlayStation 5 console bundles, games, and accessories. Next-gen gaming with DualSense haptic feedback.',
    },
    'playstation-4': {
        seo_heading: 'Buy PlayStation 4 in Nigeria - PS4 Console, Games | Ogabassey',
        seo_description: 'Shop PlayStation 4 at best prices in Nigeria. PS4 Slim, PS4 Pro, controllers, and games. Great value gaming.',
        description: 'PlayStation 4 consoles and games. Massive game library with affordable entry into console gaming.',
    },
    'nintendo-switch': {
        seo_heading: 'Buy Nintendo Switch in Nigeria - Switch OLED, Lite, Games | Ogabassey',
        seo_description: 'Shop Nintendo Switch at best prices in Nigeria. Switch OLED, Switch Lite, Mario, Zelda, Pokemon games.',
        description: 'Nintendo Switch consoles and games. Play at home or on the go with hybrid gaming.',
    },
    'xbox': {
        seo_heading: 'Buy Xbox in Nigeria - Xbox Series X, Series S, Game Pass | Ogabassey',
        seo_description: 'Shop Xbox at best prices in Nigeria. Xbox Series X, Series S, Game Pass subscriptions, controllers.',
        description: 'Xbox consoles with Game Pass for hundreds of games. Series X for 4K gaming, Series S for affordable next-gen.',
    },
    'gaming-accessories': {
        seo_heading: 'Buy Gaming Accessories in Nigeria - Controllers, Headsets | Ogabassey',
        seo_description: 'Shop gaming accessories at best prices in Nigeria. Controllers, gaming headsets, charging docks, and more.',
        description: 'Gaming accessories for console and PC. Controllers, headsets, gaming chairs, and RGB peripherals.',
    },
    'gift-cards': {
        seo_heading: 'Buy Gift Cards in Nigeria - PlayStation, Xbox, Steam | Ogabassey',
        seo_description: 'Shop gift cards at best prices in Nigeria. PlayStation Store, Xbox, Steam, iTunes gift cards. Instant delivery.',
        description: 'Digital gift cards for gaming and entertainment. PlayStation, Xbox, Steam, Nintendo eShop, and more.',
    },
    'steam-deck': {
        seo_heading: 'Buy Steam Deck in Nigeria - Steam Deck OLED, Accessories | Ogabassey',
        seo_description: 'Shop Steam Deck at best prices in Nigeria. Steam Deck OLED, original Steam Deck, docks and accessories.',
        description: 'Steam Deck handheld gaming PC. Play your Steam library anywhere with portable PC gaming.',
    },
    'vr-headsets': {
        seo_heading: 'Buy VR Headsets in Nigeria - Meta Quest, PlayStation VR | Ogabassey',
        seo_description: 'Shop VR headsets at best prices in Nigeria. Meta Quest 3, PlayStation VR2, VR accessories.',
        description: 'Virtual reality headsets for immersive gaming and experiences. Meta Quest, PlayStation VR, and accessories.',
    },
    // TV & Audio Subcategories
    'samsung-tvs': {
        seo_heading: 'Buy Samsung TVs in Nigeria - QLED, Neo QLED, Crystal UHD | Ogabassey',
        seo_description: 'Shop Samsung TVs at best prices in Nigeria. Neo QLED 8K, QLED 4K, Crystal UHD. All sizes from 43" to 85".',
        description: 'Samsung Smart TVs with Tizen OS. QLED for vibrant colors, Neo QLED for premium viewing, Crystal UHD for value.',
    },
    'lg-tvs': {
        seo_heading: 'Buy LG TVs in Nigeria - OLED, QNED, UHD TVs | Ogabassey',
        seo_description: 'Shop LG TVs at best prices in Nigeria. LG OLED, QNED, NanoCell, UHD Smart TVs with webOS.',
        description: 'LG Smart TVs with webOS. OLED for perfect blacks, QNED for premium LCD, NanoCell for color accuracy.',
    },
    'soundbars': {
        seo_heading: 'Buy Soundbars in Nigeria - Samsung, LG, Sony Sound Systems | Ogabassey',
        seo_description: 'Shop soundbars at best prices in Nigeria. Samsung Q-Series, LG, Sony sound systems with Dolby Atmos.',
        description: 'Soundbars and home theater systems. Dolby Atmos surround sound for immersive TV and movie audio.',
    },
    'headphones': {
        seo_heading: 'Buy Headphones in Nigeria - Sony, JBL, Bose Wireless Headphones | Ogabassey',
        seo_description: 'Shop headphones at best prices in Nigeria. Sony WH-1000XM5, JBL, Bose noise-cancelling wireless headphones.',
        description: 'Premium wireless headphones with active noise cancellation. Studio-quality sound for music and calls.',
    },
    'earbuds': {
        seo_heading: 'Buy Earbuds in Nigeria - AirPods, Samsung Buds, Sony Earbuds | Ogabassey',
        seo_description: 'Shop earbuds at best prices in Nigeria. Apple AirPods Pro, Samsung Galaxy Buds, Sony wireless earbuds.',
        description: 'True wireless earbuds with ANC. Compact design, long battery life, and premium sound quality.',
    },
    'portable-speakers': {
        seo_heading: 'Buy Portable Speakers in Nigeria - JBL, Sony Bluetooth Speakers | Ogabassey',
        seo_description: 'Shop portable speakers at best prices in Nigeria. JBL Flip, Charge, Sony SRS-XB series. Waterproof Bluetooth.',
        description: 'Portable Bluetooth speakers for outdoor and travel. Waterproof, long battery life, powerful bass.',
    },
    'party-speakers': {
        seo_heading: 'Buy Party Speakers in Nigeria - JBL PartyBox, Sony Power Speakers | Ogabassey',
        seo_description: 'Shop party speakers at best prices in Nigeria. JBL PartyBox, Sony party speakers with lights and bass boost.',
        description: 'High-power party speakers with LED lights. Perfect for parties, events, and outdoor entertainment.',
    },
    'gaming-speakers': {
        seo_heading: 'Buy Gaming Speakers in Nigeria - PC Speakers, Soundbars | Ogabassey',
        seo_description: 'Shop gaming speakers at best prices in Nigeria. RGB PC speakers, gaming soundbars with virtual surround.',
        description: 'Gaming audio solutions. RGB speakers, gaming soundbars, and 2.1 systems for immersive game audio.',
    },
};

async function updateCategorySEO() {
    console.log("🔍 Updating Category SEO Fields...\n");

    // Get merchant ID
    const { data: laptopsCat } = await supabase.from('categories').select('merchant_id').eq('slug', 'laptops').single();
    if (!laptopsCat) {
        console.error("❌ Cannot find laptops category for merchant ID");
        return;
    }
    const merchantId = laptopsCat.merchant_id;

    // Get all categories for this merchant
    const { data: categories } = await supabase.from('categories').select('id, slug, name, seo_heading, seo_description, description').eq('merchant_id', merchantId);

    if (!categories) {
        console.error("❌ No categories found");
        return;
    }

    console.log(`📋 Found ${categories.length} categories\n`);

    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const cat of categories) {
        const seoData = CATEGORY_SEO[cat.slug];

        if (!seoData) {
            console.log("   ⏩ No SEO data defined for:", cat.name, "(" + cat.slug + ")");
            missing++;
            continue;
        }

        // Check if already has SEO fields
        if (cat.seo_heading && cat.seo_description && cat.description) {
            console.log("   ✅ Already has SEO:", cat.name);
            skipped++;
            continue;
        }

        // Update with SEO data
        const { error } = await supabase.from('categories').update({
            seo_heading: seoData.seo_heading,
            seo_description: seoData.seo_description,
            description: seoData.description,
        }).eq('id', cat.id);

        if (error) {
            console.error("   ❌ Failed to update", cat.name, ":", error.message);
        } else {
            console.log("   🔄 Updated SEO:", cat.name);
            updated++;
        }
    }

    console.log(`\n🏁 Category SEO Update Complete!`);
    console.log(`   Updated: ${updated} | Skipped: ${skipped} | Not Defined: ${missing}`);
}

updateCategorySEO();
