
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

async function restoreMerchant() {
    const email = 'basseybjjohn@gmail.com';
    console.log(`Looking up user: ${email}`);

    // 1. Get User ID (Supabase Auth Admin)
    // We can't query auth.users directly with client usually, but service role can via auth.admin
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.error('Error listing users:', userError);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error('User not found');
        return;
    }

    console.log(`Found user ID: ${user.id}`);

    // 2. Find Merchant
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (merchantError) {
        console.error('Error finding merchant:', merchantError);
        return;
    }

    if (!merchant) {
        console.error('No merchant record found for this user.');
        return;
    }

    console.log('Current Merchant State:', {
        id: merchant.id,
        business_name: merchant.business_name,
        slug: merchant.slug,
        business_type: merchant.business_type,
        email: merchant.email
    });

    if (merchant.business_name === 'Ogabassey') {
        console.log('Merchant is already named "Ogabassey". No action needed for name.');
        // Check if we need to clean up "new fashion" records?
    } else {
        console.log('Restoring merchant to "Ogabassey"...');

        // Update
        const { data: updated, error: updateError } = await supabase
            .from('merchants')
            .update({
                business_name: 'Ogabassey',
                slug: 'ogabassey',
                // We might want to keep business_type or revert it if it changed. 
                // User didn't specify type, but assuming original name implies original state.
                // We'll leave business_type as is unless it looks obviously wrong (e.g. if "new fashion" implied a type change).
                // Safest is to just fix the name and slug.
            })
            .eq('id', merchant.id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating merchant:', updateError);
            return;
        }

        console.log('Merchant Restored:', {
            id: updated.id,
            business_name: updated.business_name,
            slug: updated.slug
        });
    }

    // Check for any mistakenly created "new fashion" records (duplicates)
    // The user mentioned "delete the new fashion record". 
    // If the logic was UPDATE, there shouldn't be a duplicate, but let's check by name.

    const { data: duplicates, error: dupError } = await supabase
        .from('merchants')
        .select('id, business_name, user_id')
        .ilike('business_name', '%new fashion%');

    if (duplicates && duplicates.length > 0) {
        console.log('Found potential duplicate/erroneous records containing "new fashion":', duplicates);

        // Only delete if it's NOT the one we just restored (which shouldn't happen as we renamed it, but safety first)
        // And verify it's not some other valid user's store.
        // Since we are running this as a one-off, I'll just LOG them for now unless I'm sure.
        // If the user's ID matches, we should have already renamed it.

        for (const dup of duplicates) {
            if (dup.id !== merchant.id) {
                console.log(`Warning: Found another merchant '${dup.business_name}' (ID: ${dup.id}). PLEASE CHECK MANUALLY.`);
            }
        }
    } else {
        console.log('No other records found with name like "new fashion".');
    }

}

restoreMerchant().catch(console.error);
