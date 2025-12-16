
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Known mappings for short names found in the audit
const SHORT_NAME_FIXES: Record<string, string> = {
    'S24': 'Samsung Galaxy S24',
    'S25': 'Samsung Galaxy S25',
    'S24 Ultra': 'Samsung Galaxy S24 Ultra',
    'S25 Ultra': 'Samsung Galaxy S25 Ultra',
    'FC24': 'EA Sports FC 24',
    'FC25': 'EA Sports FC 25',
    'NBa 24': 'NBA 2K24',
    'NBa 25': 'NBA 2K25',
    'F1 23': 'F1 2023',
    'F1 24': 'F1 2024',
    'Call of Duty': 'Call of Duty: Modern Warfare III', // Assumption, but better than just "Call of Duty"
    'GTA V': 'Grand Theft Auto V',
    'GTA 5': 'Grand Theft Auto V',
    'RDR 2': 'Red Dead Redemption 2',
    'RDR 1': 'Red Dead Redemption',
    'Mk 11': 'Mortal Kombat 11',
    'MK 1': 'Mortal Kombat 1',
    'Re 4': 'Resident Evil 4',
    'Re 4 Remake': 'Resident Evil 4 Remake',
    'Ufc 5': 'UFC 5',
    'Ufc 4': 'UFC 4'
};

function toTitleCase(str: string): string {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

async function fixNameQuality() {
    console.log('✨ Fixing Product Name Quality...\n');

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, brand')
        .neq('status', 'archived');

    if (error || !products) {
        console.error('Error fetching products', error);
        return;
    }

    let capsFixed = 0;
    let shortFixed = 0;

    // Process each product
    for (const p of products) {
        let newName = p.name;
        let modified = false;

        // 1. Fix ALL CAPS (if name is > 4 chars and has uppercase but no lowercase)
        // Ignoring acronyms like "USB", "JBL" by length check
        if (p.name.length > 4 && p.name === p.name.toUpperCase() && /[A-Z]/.test(p.name)) {
            // Apply Title Case
            newName = toTitleCase(p.name);
            // Special case cleanups after Title Casing
            newName = newName
                .replace(/\bIphone\b/g, 'iPhone')
                .replace(/\bIpad\b/g, 'iPad')
                .replace(/\bPs5\b/g, 'PS5')
                .replace(/\bPs4\b/g, 'PS4')
                .replace(/\bUsb\b/g, 'USB')
                .replace(/\bJbl\b/g, 'JBL')
                .replace(/\bLcd\b/g, 'LCD')
                .replace(/\bRgb\b/g, 'RGB');

            console.log(`🔠 [Caps] ${p.name} -> ${newName}`);
            capsFixed++;
            modified = true;
        }

        // 2. Fix Short Names from Mapping
        if (SHORT_NAME_FIXES[p.name]) {
            console.log(`📐 [Short] ${p.name} -> ${SHORT_NAME_FIXES[p.name]}`);
            newName = SHORT_NAME_FIXES[p.name];
            shortFixed++;
            modified = true;
        }

        // 3. Fix Game Capitalization (e.g. "SIfu" -> "Sifu", "NBa" -> "NBA")
        // The previous script output showed weird CamelCase like "AVengers"
        if (/[A-Z]{2}[a-z]/.test(newName)) {
            // Heuristic: If starts with 2 caps then lower (like "AVengers"), fix it
            // Simple logic: if 2nd char is upper and 3rd is lower, lower the 2nd char?
            // Actually, the previous output showed "AVengers". Let's brute force knowns.
            if (newName.startsWith('AVengers')) newName = newName.replace('AVengers', 'Avengers');
            if (newName.startsWith('BEn 10')) newName = newName.replace('BEn 10', 'Ben 10');
            if (newName.startsWith('CYberpunk')) newName = newName.replace('CYberpunk', 'Cyberpunk');
            if (newName.startsWith('LIes Of P')) newName = newName.replace('LIes Of P', 'Lies of P');
            if (newName.startsWith('MAn Eater')) newName = newName.replace('MAn Eater', 'Maneater');
            if (newName.startsWith('NBa ')) newName = newName.replace('NBa ', 'NBA ');
            if (newName.startsWith('SAck Boy')) newName = newName.replace('SAck Boy', 'Sackboy');

            if (newName !== p.name && !modified) {
                console.log(`👾 [GameCaps] ${p.name} -> ${newName}`);
                modified = true;
                capsFixed++; // counting as caps fix
            }
        }

        if (modified) {
            const { error: updateError } = await supabase
                .from('products')
                .update({ name: newName })
                .eq('id', p.id);

            if (updateError) console.error(`Failed update ID ${p.id}`, updateError);
        }
    }

    console.log(`\n🎉 DONE: Fixed ${capsFixed} bad caps, expanded ${shortFixed} short names.`);
}

fixNameQuality().catch(console.error);
