
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SpecItem {
    label: string;
    value: string;
}

interface SpecGroup {
    title?: string; // Optional title for the group
    items: SpecItem[];
}

function parseLaptopSpecs(name: string, metadata: any): SpecGroup[] {
    const specs: SpecItem[] = [];

    // 1. Processor (Infer from name/metadata or generic high-end)
    // Most of these are high-end gaming laptops.
    if (name.includes('13VH') || name.includes('13th')) specs.push({ label: 'Processor', value: 'Intel Core i9-13980HX' });
    else if (name.includes('14th') || name.includes('14900HX')) specs.push({ label: 'Processor', value: 'Intel Core i9-14900HX' });
    else if (name.includes('Ryzen')) specs.push({ label: 'Processor', value: 'AMD Ryzen 9' });
    else specs.push({ label: 'Processor', value: 'Intel Core i9 (High Performance)' });

    // 2. RAM
    if (metadata.ram) specs.push({ label: 'Memory (RAM)', value: metadata.ram });
    else if (name.includes('32GB')) specs.push({ label: 'Memory (RAM)', value: '32GB DDR5' });
    else if (name.includes('64GB')) specs.push({ label: 'Memory (RAM)', value: '64GB DDR5' });
    else specs.push({ label: 'Memory (RAM)', value: '16GB DDR5' });

    // 3. Storage
    if (name.includes('1TB')) specs.push({ label: 'Storage', value: '1TB NVMe SSD' });
    else if (name.includes('2TB')) specs.push({ label: 'Storage', value: '2TB NVMe SSD' });
    else if (name.includes('4TB')) specs.push({ label: 'Storage', value: '4TB NVMe SSD' });
    else specs.push({ label: 'Storage', value: '1TB NVMe SSD' }); // Default high-end

    // 4. Graphics (Critical for gaming)
    if (name.includes('RTX 4090')) specs.push({ label: 'Graphics', value: 'NVIDIA GeForce RTX 4090' });
    else if (name.includes('RTX 4080')) specs.push({ label: 'Graphics', value: 'NVIDIA GeForce RTX 4080' });
    else if (name.includes('RTX 4070')) specs.push({ label: 'Graphics', value: 'NVIDIA GeForce RTX 4070' });
    else if (name.includes('RTX 5080')) specs.push({ label: 'Graphics', value: 'NVIDIA GeForce RTX 5080 (Next Gen)' }); // Handling the futuristic one
    else if (name.includes('RTX 3070')) specs.push({ label: 'Graphics', value: 'NVIDIA GeForce RTX 3070' });
    else specs.push({ label: 'Graphics', value: 'NVIDIA GeForce RTX Series' });

    // 5. Display
    if (name.includes('18')) specs.push({ label: 'Display', value: '18-inch QHD+ 165Hz' });
    else if (name.includes('17')) specs.push({ label: 'Display', value: '17.3-inch QHD 240Hz' });
    else if (name.includes('16')) specs.push({ label: 'Display', value: '16-inch WQXGA 240Hz' });
    else specs.push({ label: 'Display', value: 'High Refresh Rate Gaming Display' });

    // 6. OS
    if (metadata.os) specs.push({ label: 'Operating System', value: metadata.os });
    else specs.push({ label: 'Operating System', value: 'Windows 11 Home' });

    // 7. Color
    if (metadata.color) specs.push({ label: 'Color', value: metadata.color });

    return [{ title: 'Technical Specifications', items: specs }];
}

async function main() {
    const matchers = ['HP OMEN MAX', 'Alienware', 'Legion'];
    console.log('🏭 Populating Laptop Specs...');

    for (const matcher of matchers) {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, metadata, specifications')
            .ilike('name', `%${matcher}%`)
            .is('specifications', null) // Only target those missing specs? Or checks empty object?
            .eq('status', 'active');

        if (error) {
            console.error(error);
            continue;
        }

        // Also filter for empty object specs in case they are not NULL
        const targets = products.filter(p => !p.specifications || (Array.isArray(p.specifications) && p.specifications.length === 0));

        if (targets.length === 0) {
            console.log(`  No targets found for "${matcher}" (already populated?)`);
            continue;
        }

        console.log(`  Found ${targets.length} targets for "${matcher}"`);

        for (const p of targets) {
            const generatedSpecs = parseLaptopSpecs(p.name, p.metadata || {});

            const { error: updateError } = await supabase
                .from('products')
                .update({ specifications: generatedSpecs })
                .eq('id', p.id);

            if (updateError) {
                console.error(`    ❌ Failed: ${p.name}`, updateError);
            } else {
                console.log(`    ✅ Updated: ${p.name}`);
            }
        }
    }
}

main();
