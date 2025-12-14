import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Batch 2: Top 20 Nintendo Switch Games
const games = [
    { title: "The Legend of Zelda: Tears of the Kingdom (Switch)", slug: "zelda-tears-of-the-kingdom", price: 62881 },
    { title: "The Legend of Zelda: Breath of the Wild (Switch)", slug: "zelda-breath-of-the-wild", price: 56771 },
    { title: "Super Mario Odyssey (Switch)", slug: "super-mario-odyssey", price: 55956 },
    { title: "Mario Kart 8 Deluxe (Switch)", slug: "mario-kart-8-deluxe", price: 55549 },
    { title: "Super Smash Bros. Ultimate (Switch)", slug: "super-smash-bros-ultimate", price: 55956 },
    { title: "Pokémon Scarlet (Switch)", slug: "pokemon-scarlet", price: 59215 },
    { title: "Pokémon Violet (Switch)", slug: "pokemon-violet", price: 59215 },
    { title: "Pokémon Legends: Arceus (Switch)", slug: "pokemon-legends-arceus", price: 56771 },
    { title: "Luigi's Mansion 3 (Switch)", slug: "luigis-mansion-3", price: 55956 },
    { title: "Super Mario Bros. Wonder (Switch)", slug: "super-mario-bros-wonder", price: 55956 },
    { title: "Animal Crossing: New Horizons (Switch)", slug: "animal-crossing-new-horizons", price: 55956 },
    { title: "Splatoon 3 (Switch)", slug: "splatoon-3", price: 55956 },
    { title: "Fire Emblem: Three Houses (Switch)", slug: "fire-emblem-three-houses", price: 62067 },
    { title: "Metroid Dread (Switch)", slug: "metroid-dread", price: 57993 },
    { title: "Donkey Kong Country Returns HD (Switch)", slug: "donkey-kong-country-returns-hd", price: 57993 },
    { title: "The Witcher 3: Wild Hunt (Switch)", slug: "the-witcher-3-wild-hunt", price: 57993 },
    { title: "Red Dead Redemption (Switch)", slug: "red-dead-redemption", price: 43736 },
    { title: "Minecraft (Switch)", slug: "minecraft", price: 37625 },
    { title: "GTA: The Trilogy (Switch)", slug: "gta-trilogy-definitive-edition", price: 47809 },
    { title: "Dark Souls Remastered (Switch)", slug: "dark-souls-remastered", price: 47809 }
];

async function seedGames() {
    console.log(`Seeding ${games.length} Nintendo Switch games...`);

    // Fetch Merchant ID (Ogabassey)
    let { data: merchant, error: mError } = await supabase
        .from('merchants')
        .select('id')
        .ilike('business_name', '%Ogabassey%')
        .single();

    if (mError || !merchant) {
        console.error("Merchant 'Ogabassey' not found:", mError);
        const { data: anyMerchant } = await supabase.from('merchants').select('id').limit(1).single();
        if (!anyMerchant) { console.error("No merchants found!"); return; }
        merchant = anyMerchant;
    }
    console.log("Using Merchant:", merchant.id);

    for (const game of games) {
        const { data: existing } = await supabase.from('products').select('id').eq('name', game.title).single();

        if (existing) {
            console.log(`Skipping ${game.title} (Exists: ${existing.id})`);
            continue;
        }

        const { data, error } = await supabase.from('products').insert({
            merchant_id: merchant.id,
            name: game.title,
            price: game.price,
            category: 'Video Games',
            brand: 'Nintendo',
            description: `Experience ${game.title} on Nintendo Switch.`,
            stock_quantity: 10,
            status: 'active',
            slug: game.slug,
            meta_title: `${game.title} - Buy on Ogabassey`,
            meta_description: `Buy ${game.title} for Nintendo Switch at the best price on Ogabassey.`
        }).select().single();

        if (error) console.error(`Failed to insert ${game.title}:`, error.message);
        else console.log(`Created: ${game.title} (${data.id})`);
    }
}

seedGames();
