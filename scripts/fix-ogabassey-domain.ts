
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixDomain() {
    console.log('🔍 Checking Merchant "Ogabassey" by slug...');

    // 1. Get Merchant ID using SLUG
    // Using slug 'ogabassey'
    const { data: merchants, error: merchantError } = await supabase
        .from('merchants')
        .select('id, slug')
        .eq('slug', 'ogabassey');

    if (merchantError) {
        console.error('❌ Error fetching merchants:', merchantError);
        return;
    }

    if (!merchants || merchants.length === 0) {
        // Try exploring what slug might be closest if exact match fails, or just list all slugs
        console.error('❌ Merchant with slug "ogabassey" not found. Listing top 5 merchants to debug:');
        const { data: allMerchants } = await supabase.from('merchants').select('id, slug').limit(5);
        console.log(allMerchants);
        return;
    }

    const ogabassey = merchants[0];
    console.log(`✅ Found Merchant: slug=${ogabassey.slug} (${ogabassey.id})`);

    // 2. Check Domain Record
    console.log(`\n🔍 Checking domain "ogabassey.com"...`);
    const { data: domains, error: domainError } = await supabase
        .from('domains')
        .select('*')
        .eq('domain', 'ogabassey.com');

    if (domainError) {
        console.error('❌ Error fetching domains:', domainError);
        return;
    }

    if (domains && domains.length > 0) {
        console.log('⚠️ Domain record exists:', domains);

        const domain = domains[0];
        let needsUpdate = false;
        const updates: any = {};

        if (domain.status !== 'active') {
            console.log('🛠 Need to update status to active');
            updates.status = 'active';
            needsUpdate = true;
        }

        if (domain.merchant_id !== ogabassey.id) {
            console.log(`🛠 Need to re-link merchant_id from ${domain.merchant_id} to ${ogabassey.id}`);
            updates.merchant_id = ogabassey.id;
            needsUpdate = true;
        }

        if (needsUpdate) {
            const { error: updateError } = await supabase
                .from('domains')
                .update(updates)
                .eq('id', domain.id);

            if (updateError) console.error('❌ Update failed:', updateError);
            else console.log('✅ Domain updated!');
        } else {
            console.log('✅ Domain is already active and linked correctly.');
        }

    } else {
        console.log('❌ Domain record NOT found. Creating it...');
        const { data: newDomain, error: insertError } = await supabase
            .from('domains')
            .insert({
                domain: 'ogabassey.com',
                merchant_id: ogabassey.id,
                status: 'active',
                is_primary: true
            })
            .select();

        if (insertError) {
            console.error('❌ Failed to insert domain:', insertError);
        } else {
            console.log('✅ Domain inserted successfully:', newDomain);
        }
    }

    console.log('\n🔍 Checking "www.ogabassey.com"...');
    const { data: wwwDomains, error: wwwDomainError } = await supabase
        .from('domains')
        .select('*')
        .eq('domain', 'www.ogabassey.com');

    if (wwwDomains && wwwDomains.length === 0) {
        console.log('❌ www.ogabassey.com NOT found. Creating it...');
        const { data: newWWW, error: insertWWWError } = await supabase
            .from('domains')
            .insert({
                domain: 'www.ogabassey.com',
                merchant_id: ogabassey.id,
                status: 'active',
                is_primary: false
            })
            .select();

        if (insertWWWError) console.error('❌ Failed to insert www domain:', insertWWWError);
        else console.log('✅ www.ogabassey.com inserted successfully');
    } else {
        console.log('✅ www.ogabassey.com exists.');
    }

}

checkAndFixDomain();
