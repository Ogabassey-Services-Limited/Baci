import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
    const { data: all } = await supabase.from('products').select('name, images').ilike('name', '%oppo%');
    const unmatched = all.filter(p => !p.images || p.images.length === 0 || p.images[0] === null);
    console.log('📉 Unmatched Oppo Products:', unmatched.length);
    unmatched.forEach(p => console.log('   -', p.name));
}
run();
