
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase public credentials');
    process.exit(1);
}

// Create client with ANON key - simulating public access
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAnonAccess() {
    console.log('🔍 Testing ANON access to "domains" table...');
    const { data, error } = await supabase
        .from('domains')
        .select('merchant_id, domain')
        .eq('domain', 'ogabassey.com')
        .eq('status', 'active')
        .single();

    if (error) {
        console.error('❌ ANON Access Failed:', error);
        console.log('⚠️  This confirms RLS policy prevents public read of domains.');
    } else if (!data) {
        console.log('⚠️  Query succeeded but returned no data (RLS might filter rows).');
    } else {
        console.log('✅ ANON Access Succeeded:', data);
    }
}

testAnonAccess();
