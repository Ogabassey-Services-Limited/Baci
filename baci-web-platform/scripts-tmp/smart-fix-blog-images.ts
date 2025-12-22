import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fallback if no product match found
const FALLBACK_IMAGE =
  'https://cdn.ogabassey.com/blog/2025/07/Apple_MacBook-Pro_14-16-inch_10182021_big.jpg.large_2x-1024x1024.avif';

async function smartFixBlogImages() {
  console.log('🚀 Starting Smart Fix for Blog Images...');

  // 1. Get all published posts
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug, featured_image_url')
    .eq('status', 'published');

  if (error || !posts) {
    console.error('Failed to fetch posts:', error);
    return;
  }

  console.log(`Scanning ${posts.length} posts for broken images...`);

  for (const p of posts) {
    let isBroken = false;

    // Check availability
    if (!p.featured_image_url) {
      isBroken = true;
    } else {
      try {
        const res = await fetch(p.featured_image_url, {
          method: 'HEAD',
          timeout: 5000,
        });
        if (res.status !== 200) isBroken = true;
      } catch (e) {
        isBroken = true;
      }
    }

    if (isBroken) {
      console.log(`\n🔧 Fixing: ${p.title}`);
      console.log(`   Old URL: ${p.featured_image_url}`);

      let newImageUrl = FALLBACK_IMAGE;

      // Try to find a matching product image
      // Extract keywords (simplistic approach: first 2 words or specific brands)
      const keywords = p.title
        .split(' ')
        .slice(0, 3)
        .join(' ')
        .replace(/[:,]/g, '');
      // Better strategy: Search full title in products, or key terms

      // Try searching products similar to title
      const { data: products } = await supabase
        .from('products')
        .select('name, images')
        .textSearch('name', keywords, { type: 'websearch', config: 'english' })
        .limit(5);

      if (products && products.length > 0) {
        // Find first product with a valid image
        for (const prod of products) {
          if (prod.images && prod.images.length > 0) {
            const prodImg = prod.images[0];
            // Verify this product image works
            try {
              const res = await fetch(prodImg, {
                method: 'HEAD',
                timeout: 3000,
              });
              if (res.status === 200) {
                newImageUrl = prodImg;
                console.log(`   ✅ Found matching product: ${prod.name}`);
                break;
              }
            } catch (e) {}
          }
        }
      } else {
        console.log(
          `   ⚠️ No matching product found for keywords "${keywords}". Using fallback.`
        );
      }

      // Update database
      const { error: updateError } = await supabase
        .from('blog_posts')
        .update({ featured_image_url: newImageUrl })
        .eq('id', p.id);

      if (updateError) {
        console.error(`   ❌ Update failed: ${updateError.message}`);
      } else {
        console.log(`   ✨ Updated to: ${newImageUrl}`);
      }
    }
  }

  console.log('\n✅ Smart Fix Complete.');
}

smartFixBlogImages();
