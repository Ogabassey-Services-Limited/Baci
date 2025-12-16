
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const matchers = ['HP OMEN MAX', 'SAMSUNG OLED', 'Alienware', 'Legion'];

    console.log('Auditing Specs for:', matchers.join(', '));

    for (const matcher of matchers) {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, metadata, specifications')
            .ilike('name', `%${matcher}%`)
            .eq('status', 'active');

        if (error) {
            console.error(error);
            continue;
        }

        if (data.length > 0) {
            console.log(`\nFound ${data.length} items for "${matcher}":`);
            data.forEach(p => {
                const hasMetadata = p.metadata && Object.keys(p.metadata).length > 0;
                const hasSpecs = p.specifications && Object.keys(p.specifications).length > 0;
                console.log(`  - ${p.name}`);
                console.log(`    Metadata: ${hasMetadata ? JSON.stringify(p.metadata).substring(0, 100) + '...' : 'EMPTY'}`);
                console.log(`    Specs: ${hasSpecs ? JSON.stringify(p.specifications).substring(0, 100) + '...' : 'EMPTY'}`);
            });
        }
    }
}

main();
