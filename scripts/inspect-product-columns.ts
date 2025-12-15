
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectColumns() {
    console.log('Fetching one product to inspect columns...');
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching product:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Product Columns:', Object.keys(data[0]));
        console.log('Sample category_slug:', data[0].category_slug);
        console.log('Sample category:', data[0].category);
    } else {
        console.log('No products found.');
    }
}

inspectColumns();
