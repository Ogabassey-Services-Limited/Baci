
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TO_DELETE = [
    '46e5f864-b62b-46b8-8dea-650ac27ebaaa', // Avengers
    'a19f523b-ac4e-4242-988a-74506814717d', // Sniper Elite 4
    '94a572b2-3dd0-46c7-8151-8184255ad800', // Tennis World Tour
    'b0878b38-a535-4a2b-88c7-3451c0182aeb', // COD Vanguard
    'b4462a36-a8e8-420a-9511-f000fd85d376', // Battlefield 2042
];

async function deleteProducts() {
    console.log('🚀 Deleting obsolete products...');

    for (const id of TO_DELETE) {
        // 1. Delete children FIRST (Foreign Key Constraint)
        const { error: childError, count } = await supabase
            .from('products')
            .delete({ count: 'exact' })
            .eq('parent_product_id', id);

        if (childError) {
            console.error(`   ❌ Failed to delete children for ${id}:`, childError.message);
        } else {
            console.log(`   ✅ Deleted ${count} children for parent ${id}`);
        }

        // 2. Delete parent
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error(`❌ Failed to delete parent ${id}:`, deleteError.message);
        } else {
            console.log(`✅ Deleted parent ${id}`);
        }
    }
}

async function run() {
    await deleteProducts();
}

run();
