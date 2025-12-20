import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBlogImages() {
    console.log('🚀 Checking Blog Post Images...');

    const { data: posts, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, featured_image_url')
        .eq('status', 'published');

    if (error) {
        console.error('Failed to fetch posts:', error);
        return;
    }

    if (!posts || posts.length === 0) {
        console.log('No published posts found.');
        return;
    }

    console.log(`Found ${posts.length} posts. Checking images...`);

    let brokenCount = 0;

    for (const p of posts) {
        const url = p.featured_image_url;

        if (!url) {
            console.log(`⚠️ [NO IMAGE] ${p.title} (${p.slug})`);
            continue;
        }

        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.status !== 200) {
                console.log(`❌ [${res.status}] ${p.title}\n   URL: ${url}`);
                brokenCount++;
            } else {
                console.log(`✅ [200] ${p.title}`);
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(`❌ [ERROR] ${p.title} - ${message}\n   URL: ${url}`);
            brokenCount++;
        }
    }

    console.log(`\nDone. Found ${brokenCount} broken images.`);
}

checkBlogImages();
