import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const games = [
    { title: "EA Sports FC 25 (PS5)", csvName: "PS5 FC25", price: 31500 },
    { title: "Call of Duty: Black Ops 6 (PS5)", csvName: "PS5 CALL OF DUTY BLACK OPS 6", price: 91582 },
    { title: "Marvel's Spider-Man 2 (PS5)", csvName: "PS5 SPIDERMAN 2", price: 51868 },
    { title: "God of War Ragnarök (PS5)", csvName: "PS5 GOD OF WAR RAGNAROK", price: 38425 },
    { title: "Grand Theft Auto V (PS5)", csvName: "PS5 GTA V", price: 27019 },
    { title: "Elden Ring (PS5)", csvName: "PS5 ELDEN RING", price: 37203 },
    { title: "Mortal Kombat 1 (PS5)", csvName: "PS5 MORTAL KOMBAT 1", price: 46572 },
    { title: "Tekken 8 (PS5)", csvName: "PS5 TEKKEN 8", price: 43721 },
    { title: "Hogwarts Legacy (PS5)", csvName: "PS5 HOGWARTS LEGACY", price: 30686 },
    { title: "The Last of Us Part II Remastered (PS5)", csvName: "PS5 LAST OF US 2 -REMASTERED", price: 44536 },
    { title: "Cyberpunk 2077 (PS5)", csvName: "PS5 CYBERPUNK", price: 48609 },
    { title: "Assassin's Creed Mirage (PS5)", csvName: "PS5 ASSASSINS CREED MIRAGE", price: 29056 },
    { title: "Resident Evil 4 Remake (PS5)", csvName: "PS5 RESIDENT EVIL 4 REMAKE", price: 25390 },
    { title: "Star Wars Jedi: Survivor (PS5)", csvName: "PS5 STARWARS JEDI SURVIVOR", price: 38425 },
    { title: "Ghost of Tsushima Director's Cut (PS5)", csvName: "PS5 GHOST OF TSUSHIMA DIRECTORS CUT", price: 66940 },
    { title: "Gran Turismo 7 (PS5)", csvName: "PS5 GRAN TURISMO SPORT 7", price: 44536 },
    { title: "Horizon Forbidden West (PS5)", csvName: "PS5 HORIZON FORBIDDEN WEST", price: 40462 },
    { title: "NBA 2K25 (PS5)", csvName: "PS5 NBA 25", price: 26205 },
    { title: "WWE 2K24 (PS5)", csvName: "PS5 WWE 24", price: 36389 },
    { title: "Final Fantasy XVI (PS5)", csvName: "PS5 FINAL FANTASY XVI", price: 33130 }
];

async function seedGames() {
    console.log(`Seeding ${games.length} games...`);

    // Fetch Merchant ID (Ogabassey)
    let { data: merchant, error: mError } = await supabase
        .from('merchants')
        .select('id')
        .ilike('business_name', '%Ogabassey%')
        .single();

    if (mError || !merchant) {
        console.error("Merchant 'Ogabassey' not found:", mError);
        // Fallback: get any merchant
        const { data: anyMerchant } = await supabase.from('merchants').select('id').limit(1).single();
        if (!anyMerchant) { console.error("No merchants found!"); return; }
        console.log("Using fallback merchant:", anyMerchant.id);
        merchant = anyMerchant;
    } else {
        console.log("Using Merchant:", merchant.id);
    }

    for (const game of games) {
        // Check if exists
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
            brand: 'PlayStation',
            description: `Experience ${game.title} on PlayStation 5.`,
            stock_quantity: 10,
            status: 'active',
            slug: game.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            meta_title: `${game.title} - Buy on Ogabassey`,
            meta_description: `Buy ${game.title} for PS5 at the best price on Ogabassey.`
        }).select().single();

        if (error) console.error(`Failed to insert ${game.title}:`, error.message);
        else console.log(`Created: ${game.title} (${data.id})`);
    }
}

seedGames();
