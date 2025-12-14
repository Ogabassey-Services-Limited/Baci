import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function listApple() {
    const { data } = await supabase
        .from('products')
        .select('name')
        .or('brand.ilike.Apple,name.ilike.%Apple%,name.ilike.%iPhone%,name.ilike.%MacBook%,name.ilike.%iPad%')
        .limit(50);

    console.log(JSON.stringify(data, null, 2));
}

listApple();
