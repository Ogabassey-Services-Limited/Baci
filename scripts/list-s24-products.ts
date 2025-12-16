
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listS24Products() {
    console.log('Fetching Samsung Galaxy S24 products...');

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, price, condition, status')
        .ilike('name', '%Samsung Galaxy S24%')
        .order('name');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`Found ${products.length} products:\n`);

    // Group by likely model
    const s24 = products.filter(p => !p.name.includes('Plus') && !p.name.includes('+') && !p.name.includes('Ultra'));
    const s24Plus = products.filter(p => p.name.includes('Plus') || p.name.includes('+'));
    const s24Ultra = products.filter(p => p.name.includes('Ultra'));

    console.log('--- S24 Base ---');
    s24.forEach(p => console.log(`[${p.status}] ${p.name} - ${p.price}`));

    console.log('\n--- S24 Plus ---');
    s24Plus.forEach(p => console.log(`[${p.status}] ${p.name} - ${p.price}`));

    console.log('\n--- S24 Ultra ---');
    s24Ultra.forEach(p => console.log(`[${p.status}] ${p.name} - ${p.price}`));
}

listS24Products();
