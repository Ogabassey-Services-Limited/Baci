import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Keywords that indicate wrong categorization
const audioKeywords = ['headphone', 'earbuds', 'earphones', 'speaker', 'soundbar', 'buds', 'tune', 'live', 'jr310', 'airpods'];
const accessoryKeywords = ['tag', 'tracker', 'case', 'charger', 'cable', 'adapter', 'stand', 'mount'];
const wearableKeywords = ['watch', 'fit', 'band', 'tracker'];
const gamingKeywords = ['playstation', 'xbox', 'nintendo', 'switch', 'controller', 'joystick'];

async function findMiscategorized() {
  console.log('=== FINDING MISCATEGORIZED PRODUCTS ===\n');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .neq('status', 'archived');

  if (!products) {
    console.log('No products found');
    return;
  }

  const issues: { product: any; issue: string; suggestedCategory: string }[] = [];

  for (const p of products) {
    const nameLower = p.name?.toLowerCase() || '';
    const brandLower = p.brand?.toLowerCase() || '';
    const categoryLower = p.category?.toLowerCase() || '';

    // Check for audio products in phone/smartphone category
    if (categoryLower.includes('phone') || categoryLower.includes('smartphone')) {
      if (audioKeywords.some(k => nameLower.includes(k)) || brandLower === 'jbl' || brandLower === 'harman kardon') {
        issues.push({ product: p, issue: 'Audio product in phone category', suggestedCategory: 'Headphones' });
      }
      else if (accessoryKeywords.some(k => nameLower.includes(k))) {
        issues.push({ product: p, issue: 'Accessory in phone category', suggestedCategory: 'Accessories' });
      }
      else if (wearableKeywords.some(k => nameLower.includes(k)) && !nameLower.includes('iphone')) {
        issues.push({ product: p, issue: 'Wearable in phone category', suggestedCategory: 'Wearables' });
      }
    }

    // Check for phones in wrong categories
    if (categoryLower.includes('laptop') || categoryLower.includes('computer')) {
      if (nameLower.includes('iphone') || nameLower.includes('galaxy s') || nameLower.includes('pixel')) {
        issues.push({ product: p, issue: 'Phone in laptop category', suggestedCategory: 'Smartphones' });
      }
    }

    // Check for gaming consoles/accessories
    if (categoryLower.includes('phone') || categoryLower.includes('laptop')) {
      if (gamingKeywords.some(k => nameLower.includes(k) || brandLower.includes(k))) {
        issues.push({ product: p, issue: 'Gaming product in phone/laptop category', suggestedCategory: 'Gaming' });
      }
    }
  }

  // Group by issue type
  const grouped: Record<string, typeof issues> = {};
  for (const item of issues) {
    const key = item.issue;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  console.log(`Found ${issues.length} miscategorized products:\n`);

  for (const [issue, items] of Object.entries(grouped)) {
    console.log(`\n=== ${issue.toUpperCase()} (${items.length}) ===`);
    for (const item of items) {
      console.log(`- ${item.product.brand}: ${item.product.name}`);
      console.log(`  Current: ${item.product.category} → Suggested: ${item.suggestedCategory}`);
    }
  }

  console.log('\n\n=== SUMMARY ===');
  for (const [issue, items] of Object.entries(grouped)) {
    console.log(`${issue}: ${items.length}`);
  }
  console.log(`\nTOTAL: ${issues.length} miscategorized products`);
}

findMiscategorized();