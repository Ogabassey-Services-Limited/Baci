import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadLogo() {
    const logoPath = path.join(process.cwd(), 'public', 'baci-logo.png');
    const logoBuffer = fs.readFileSync(logoPath);

    console.log('Uploading logo from:', logoPath);

    const { data, error } = await supabase.storage
        .from('media')
        .upload('platform/baci-logo.png', logoBuffer, {
            contentType: 'image/png',
            upsert: true,
        });

    if (error) {
        console.error('Upload error:', error.message);
        process.exit(1);
    }

    const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl('platform/baci-logo.png');

    console.log('Logo uploaded successfully!');
    console.log('Public URL:', urlData.publicUrl);
}

uploadLogo();
