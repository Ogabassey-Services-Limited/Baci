
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMerchantState() {
    const email = 'basseybjjohn@gmail.com';
    console.log("Looking up user:", email);

    // 1. Get User
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);

    if (!user) {
        console.error('User not found');
        return;
    }
    console.log(`User ID: ${user.id}`);

    // 2. Get Merchant
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (!merchant) {
        console.error('Merchant not found');
        return;
    }

    console.log('--- Merchant Table ---');
    console.log('ID:', merchant.id);
    console.log('Business Name:', merchant.business_name);
    console.log('Slug:', merchant.slug);
    console.log('----------------------');

    // 3. Get Domains
    const { data: domains, error: domainError } = await supabase
        .from('domains')
        .select('*')
        .eq('merchant_id', merchant.id);

    console.log('--- Domains Table ---');
    if (domains && domains.length > 0) {
        domains.forEach(d => {
            console.log("Domain:", d.domain, "(Type: " + d.domain_type + ", Primary: " + d.is_primary + ")");
        });
    } else {
        console.log('No domains found.');
    }
    console.log('---------------------');

    // 4. Get Page Configs (Check if they mention the name)
    const { data: configs, error: configError } = await supabase
        .from('page_configs')
        .select('id, page_name, draft_config, published_config')
        .eq('merchant_id', merchant.id);

    console.log('--- Page Configs ---');
    if (configs && configs.length > 0) {
        configs.forEach(c => {
            console.log("Page:", c.page_name);
            // Deep check config for "New Fashion" string
            const configStr = JSON.stringify(c.draft_config);
            if (configStr.includes('New Fashion') || configStr.includes('new-fashion')) {
                console.log('!!! WARNING: Config contains "New Fashion" !!!');
            }
        });
    } else {
        console.log('No configs found.');
    }

}

checkMerchantState().catch(console.error);
