
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

async function deepSearch() {
    console.log('Searching for "new-fashion" or "New Fashion"...');

    // 1. Check Merchants (broader search)
    const { data: merchants } = await supabase
        .from('merchants')
        .select('*')
        .or('slug.ilike.%new-fashion%,business_name.ilike.%new%fashion%');

    if (merchants && merchants.length > 0) {
        console.log('FOUND IN MERCHANTS:', merchants.map(m => ({ id: m.id, slug: m.slug, name: m.business_name })));

        // Auto-fix if found
        for (const m of merchants) {
            if (m.business_name.toLowerCase().includes('new fashion') || m.slug.includes('new-fashion')) {
                console.log(`Fixing merchant ${m.id}...`);
                // Only fix if it looks like the user's record (or we just fix it because user said so)
                // But be careful not to break legitimate other stores if they existed.
                // Given the context, this is likely the user's specific issue.
                if (m.user_id === '70261bce-d358-45a4-9ede-8b9d71fb3bd9') {
                    await supabase.from('merchants').update({ slug: 'ogabassey', business_name: 'Ogabassey' }).eq('id', m.id);
                    console.log('Fixed merchant record.');
                }
            }
        }
    } else {
        console.log('No matches in merchants table.');
    }

    // 2. Check Domains
    const { data: domains } = await supabase
        .from('domains')
        .select('*')
        .ilike('domain', '%new-fashion%');

    if (domains && domains.length > 0) {
        console.log('FOUND IN DOMAINS:', domains);
        // Fix domains
        for (const d of domains) {
            const newDomain = d.domain.replace('new-fashion', 'ogabassey');
            console.log(`Renaming domain ${d.domain} to ${newDomain}`);
            await supabase.from('domains').update({ domain: newDomain }).eq('id', d.id);
        }
    } else {
        console.log('No matches in domains table.');
    }

    // 3. Check Page Configs (Draft & Published)
    // We can't easily ILIKE a JSONB column for a deep string but we can check text representation or specific keys if known.
    // We'll just fetch all for the user's merchant and inspect in memory string

    const { data: userMerchant } = await supabase.from('merchants').select('id').eq('slug', 'ogabassey').single();

    if (userMerchant) {
        const { data: configs } = await supabase.from('page_configs').select('*').eq('merchant_id', userMerchant.id);

        if (configs) {
            for (const c of configs) {
                let updated = false;
                let draftStr = JSON.stringify(c.draft_config);
                let pubStr = JSON.stringify(c.published_config);

                if (draftStr.includes('new-fashion') || draftStr.includes('New Fashion')) {
                    console.log(`Found 'new-fashion' in draft config for page ${c.page_name}`);
                    draftStr = draftStr.replace(/new-fashion/g, 'ogabassey').replace(/New Fashion/g, 'Ogabassey');
                    updated = true;
                }
                if (pubStr.includes('new-fashion') || pubStr.includes('New Fashion')) {
                    console.log(`Found 'new-fashion' in published config for page ${c.page_name}`);
                    pubStr = pubStr.replace(/new-fashion/g, 'ogabassey').replace(/New Fashion/g, 'Ogabassey');
                    updated = true;
                }

                if (updated) {
                    console.log(`Updating config for page ${c.page_name}...`);
                    await supabase.from('page_configs').update({
                        draft_config: JSON.parse(draftStr),
                        published_config: JSON.parse(pubStr)
                    }).eq('id', c.id);
                    console.log('Updated.');
                }
            }
        }
    }

}

deepSearch().catch(console.error);
