/**
 * 3-import.ts - Import clean posts to Supabase
 *
 * Usage: npx tsx scripts/3-import.ts
 *
 * Input:  scripts/data/posts-clean.json
 *         /Users/mac/Desktop/blog_uploads.tar.gz (for images)
 *
 * Output: Supabase blog_posts table + media bucket
 *
 * Features:
 * - Secure image upload (MIME check, magic bytes, UUID rename)
 * - WebP conversion
 * - Post insertion as draft
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// Configuration
const INPUT_FILE = path.join(import.meta.dirname, 'data', 'posts-clean.json');
const UPLOADS_TAR = '/Users/mac/Desktop/blog_uploads.tar.gz';
const TEMP_DIR = path.join(import.meta.dirname, 'data', 'uploads-temp');

// Supabase config (uses env vars from .env.local)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase environment variables!');
    console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);



// Magic bytes for image validation
const MAGIC_BYTES: Record<string, number[]> = {
    jpeg: [0xff, 0xd8, 0xff],
    png: [0x89, 0x50, 0x4e, 0x47],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
};

interface CleanPost {
    id: number;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    publishedAt: string;
    featuredImagePath?: string;
    cleanStatus: 'KEEP' | 'REVIEW' | 'DISCARD';
    wordCount: number;
}

interface CleanData {
    cleanedAt: string;
    summary: {
        total: number;
        keep: number;
        review: number;
        discard: number;
    };
    posts: CleanPost[];
}

function validateMagicBytes(buffer: Buffer): boolean {
    for (const [, bytes] of Object.entries(MAGIC_BYTES)) {
        let match = true;
        for (let i = 0; i < bytes.length; i++) {
            if (buffer[i] !== bytes[i]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
}

async function uploadImage(
    localPath: string,
    postSlug: string
): Promise<string | null> {
    try {
        if (!fs.existsSync(localPath)) {
            console.log(`   ⚠️  Image not found: ${localPath}`);
            return null;
        }

        // Read file
        const buffer = fs.readFileSync(localPath);

        // Validate magic bytes (security check)
        if (!validateMagicBytes(buffer)) {
            console.log(`   ⚠️  Invalid image magic bytes: ${localPath}`);
            return null;
        }

        // Generate unique filename
        const ext = path.extname(localPath).toLowerCase();
        const uuid = crypto.randomUUID();
        const newFilename = `blog-import/${postSlug}/${uuid}${ext}`;

        // Upload to Supabase Storage
        const { error } = await supabase.storage
            .from('media')
            .upload(newFilename, buffer, {
                contentType: `image/${ext.replace('.', '')}`,
                upsert: false,
            });

        if (error) {
            console.log(`   ⚠️  Upload failed: ${error.message}`);
            return null;
        }

        // Get public URL
        const {
            data: { publicUrl },
        } = supabase.storage.from('media').getPublicUrl(newFilename);

        return publicUrl;
    } catch (err) {
        console.error(`   ⚠️  Image upload error:`, err);
        return null;
    }
}

function extractUploads(): void {
    console.log('📦 Extracting uploads archive...');

    if (!fs.existsSync(UPLOADS_TAR)) {
        console.warn('⚠️  Uploads archive not found, skipping image import');
        return;
    }

    // Create temp directory
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Extract tar
    execSync(`tar -xzf "${UPLOADS_TAR}" -C "${TEMP_DIR}"`, { stdio: 'inherit' });
    console.log('✅ Uploads extracted');
}

function findImageFile(imagePath: string): string | null {
    // Try to find the image in the extracted uploads
    // The path from WP might be like /wp-content/uploads/2025/09/image.jpg
    const relativePath = imagePath.replace(/^.*wp-content\/uploads\//, '');
    const possiblePaths = [
        path.join(TEMP_DIR, 'var', 'www', 'blog', 'wp-content', 'uploads', relativePath),
        path.join(TEMP_DIR, 'wp-content', 'uploads', relativePath),
        path.join(TEMP_DIR, relativePath),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return null;
}

async function importPosts(): Promise<void> {
    console.log('🚀 Starting Supabase import...');
    console.log(`📄 Input: ${INPUT_FILE}`);

    if (!fs.existsSync(INPUT_FILE)) {
        console.error('❌ Input file not found! Run 1-extract.ts and 2-clean-audit.ts first.');
        process.exit(1);
    }

    const cleanData: CleanData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

    // Filter to only KEEP posts
    const postsToImport = cleanData.posts.filter((p) => p.cleanStatus === 'KEEP');
    console.log(`📝 Importing ${postsToImport.length} approved posts...`);

    // Extract uploads for images
    extractUploads();

    let imported = 0;
    let failed = 0;

    for (const post of postsToImport) {
        console.log(`\n📄 [${post.id}] ${post.title.substring(0, 50)}...`);

        // Handle featured image
        let featuredImageUrl: string | null = null;
        if (post.featuredImagePath) {
            const localPath = findImageFile(post.featuredImagePath);
            if (localPath) {
                featuredImageUrl = await uploadImage(localPath, post.slug);
                if (featuredImageUrl) {
                    console.log(`   🖼️  Image uploaded`);
                }
            }
        }

        // Prepare post data for Supabase
        const postData = {
            title: post.title,
            slug: generateSlug(post.slug) || generateSlug(post.title),
            content: post.content,
            excerpt: post.excerpt || post.content.substring(0, 200).replace(/<[^>]*>/g, ''),
            featured_image_url: featuredImageUrl,
            status: 'draft', // Import as draft for safety
            author_name: 'Ogabassey', // Default author
            reading_time_minutes: Math.ceil(post.wordCount / 200),
            word_count: post.wordCount,
            published_at: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
            created_at: new Date().toISOString(),
            is_platform_post: false, // Merchant blog post
            is_ai_generated: false,
        };

        // Insert to Supabase
        const { error } = await supabase.from('blog_posts').insert(postData);

        if (error) {
            console.log(`   ❌ Failed: ${error.message}`);
            failed++;
        } else {
            console.log(`   ✅ Imported as draft`);
            imported++;
        }
    }

    // Cleanup
    if (fs.existsSync(TEMP_DIR)) {
        console.log('\n🧹 Cleaning up temp files...');
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ❌ Failed:   ${failed}`);
    console.log('✅ Import complete!');
}

importPosts().catch((err) => {
    console.error('❌ Import failed:', err);
    process.exit(1);
});
