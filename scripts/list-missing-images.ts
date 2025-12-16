
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    try {
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('id, name, price, images') // Removed 'image'
            .eq('status', 'active')
            .order('price', { ascending: false });

        if (prodError) throw prodError;

        const noImages = products.filter(p => {
            return !p.images || !Array.isArray(p.images) || p.images.length === 0;
        });

        console.log(`Found ${noImages.length} active products without images.`);
        console.log('Top 10 High Value Missing Images:');
        noImages.slice(0, 10).forEach(p => {
            console.log(`- $${p.price} | ${p.name}`);
        });
    } catch (err) {
        console.error('Error running script:', err);
    }
}

main();
