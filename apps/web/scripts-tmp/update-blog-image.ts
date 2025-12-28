
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TARGET_SLUG = 'chip-unlocked-what-they-wont-tell-you';
const NEW_IMAGE_URL = 'https://cdn.ogabassey.com/blog/2025/12/chip-unlocked-hero.png';

async function updateBlogPost() {
    console.log(`🚀 Updating blog post: ${TARGET_SLUG}`);
    console.log(`📸 New Image URL: ${NEW_IMAGE_URL}`);

    try {
        // 1. Find the post first to verify it exists
        const { data: post, error: findError } = await supabase
            .from('blog_posts')
            .select('id, title, featured_image_url')
            .eq('slug', TARGET_SLUG)
            .single();

        if (findError) {
            console.error('❌ Error finding post:', findError.message);
            return;
        }

        if (!post) {
            console.error('❌ Post not found');
            return;
        }

        console.log(`✅ Found post: "${post.title}" (ID: ${post.id})`);
        console.log(`   Old Image: ${post.featured_image_url}`);

        // 2. Update the post
        const { data: updatedPost, error: updateError } = await supabase
            .from('blog_posts')
            .update({ featured_image_url: NEW_IMAGE_URL })
            .eq('id', post.id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error updating post:', updateError.message);
            return;
        }

        console.log(`✅ Successfully updated image!`);
        console.log(`   New Image: ${updatedPost.featured_image_url}`);

    } catch (err: any) {
        console.error('❌ Unexpected error:', err.message);
    }
}

updateBlogPost();
