
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable() {
    console.log('🔍 Inspecting merchants table...');
    const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error fetching from merchants:', error);
    } else if (data && data.length > 0) {
        console.log('✅ Sample Merchant Record Keys:', Object.keys(data[0]));
    } else {
        console.log('⚠️ Merchants table is empty or no access.');
    }

    console.log('\n🔍 Inspecting domains table...');
    const { data: dData, error: dError } = await supabase
        .from('domains')
        .select('*')
        .limit(1);

    if (dError) {
        console.error('❌ Error fetching from domains:', dError);
    } else if (dData && dData.length > 0) {
        console.log('✅ Sample Domain Record Keys:', Object.keys(dData[0]));
    } else {
        console.log('⚠️ Domains table is empty.');
    }
}

inspectTable();
