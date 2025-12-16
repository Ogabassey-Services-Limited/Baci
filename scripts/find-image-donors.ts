
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const terms = ['Alienware', 'Omen', 'Legion', 'Samsung', 'Quest'];

    for (const term of terms) {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, images')
            .eq('status', 'active')
            .ilike('name', `%${term}%`)
            .limit(5);

        if (error) {
            console.error(error);
            continue;
        }

        const withImages = data.filter(p => p.images && Array.isArray(p.images) && p.images.length > 0);

        if (withImages.length > 0) {
            console.log(`\nFound donors for "${term}":`);
            withImages.forEach(p => console.log(`  - ${p.name}: ${p.images[0]}`));
        } else {
            console.log(`\nNo donors found for "${term}"`);
        }
    }
}

main();
