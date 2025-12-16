
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkPrinters() {
    const { data: printers } = await supabase
        .from('products')
        .select('id, name, brand, images, status')
        .or('name.ilike.%printer%,category.ilike.%printer%')
        .neq('status', 'archived')
        .order('name');

    console.log('🖨️ PRINTER AUDIT');
    console.log('================');
    console.log('Total Printers:', printers?.length || 0);

    const withImages = printers?.filter(p => p.images && p.images.length > 0) || [];
    const noImages = printers?.filter(p => !p.images || p.images.length === 0) || [];

    console.log('With Images:', withImages.length);
    console.log('Missing Images:', noImages.length);
    console.log('');

    if (noImages.length > 0) {
        console.log('Printers WITHOUT images:');
        noImages.forEach(p => console.log('  -', p.name, '(' + p.brand + ')'));
    }

    if (withImages.length > 0) {
        console.log('');
        console.log('Printers WITH images:');
        withImages.forEach(p => console.log('  ✅', p.name));
    }
}
checkPrinters();
