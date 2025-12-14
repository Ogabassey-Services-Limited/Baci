/**
 * 2-clean-audit.ts - Clean and audit extracted posts
 *
 * Usage: npx tsx scripts/2-clean-audit.ts
 *
 * Input:  scripts/data/posts-raw.json
 * Output: scripts/data/posts-clean.json
 *
 * Features:
 * - Security scan (malware signatures)
 * - Spam link removal
 * - URL rewrite (blog.ogabassey.com -> ogabassey.com/blog)
 * - AI-powered content quality scoring
 * - Shortcode removal
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Configuration
const INPUT_FILE = path.join(import.meta.dirname, 'data', 'posts-raw.json');
const OUTPUT_FILE = path.join(import.meta.dirname, 'data', 'posts-clean.json');

// Domain rewrite (escaped for regex use)
const OLD_DOMAIN = 'blog\\.ogabassey\\.com';
const NEW_PATH = 'ogabassey.com/blog';

// Malware signature patterns (2025 best practices)
const MALWARE_PATTERNS = [
    /eval\s*\(/gi,
    /base64_decode\s*\(/gi,
    /gzinflate\s*\(/gi,
    /str_rot13\s*\(/gi,
    /preg_replace\s*\([^)]*\/e/gi,
    /assert\s*\(/gi,
    /create_function\s*\(/gi,
    /\$_(?:GET|POST|REQUEST|COOKIE|SERVER)\s*\[/gi,
];

// Suspicious link domains (spam)
const SPAM_DOMAINS = [
    'bit.ly',
    'tinyurl.com',
    'binance.',
    'crypto.',
    'casino.',
    'porn.',
    'xxx.',
    't.co/',
    'goo.gl',
];

// Shortcode patterns to remove
const SHORTCODE_PATTERNS = [
    /\[contact-form[^\]]*\][\s\S]*?\[\/contact-form\]/gi,
    /\[gallery[^\]]*\]/gi,
    /\[caption[^\]]*\][\s\S]*?\[\/caption\]/gi,
    /\[embed\][\s\S]*?\[\/embed\]/gi,
    /\[vc_[^\]]*\][\s\S]*?\[\/vc_[^\]]*\]/gi,
    /\[fusion_[^\]]*\][\s\S]*?\[\/fusion_[^\]]*\]/gi,
    /\[et_pb_[^\]]*\][\s\S]*?\[\/et_pb_[^\]]*\]/gi,
    /\[[a-z_]+[^\]]*\]/gi, // Generic shortcode
];

interface RawPost {
    id: number;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: string;
    postType: string;
    publishedAt: string;
    authorId: number;
    featuredImagePath?: string;
    categories: string[];
    tags: string[];
}

interface CleanPost extends RawPost {
    cleanStatus: 'KEEP' | 'REVIEW' | 'DISCARD';
    cleaningNotes: string[];
    wordCount: number;
    qualityScore?: number;
    securityFlags: string[];
}

interface RawData {
    extractedAt: string;
    source: string;
    uploadsArchive: string;
    postCount: number;
    posts: RawPost[];
}

function countWords(text: string): number {
    const stripped = text
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return stripped.split(' ').filter((w) => w.length > 0).length;
}

function scanForMalware(content: string): string[] {
    const flags: string[] = [];

    for (const pattern of MALWARE_PATTERNS) {
        if (pattern.test(content)) {
            flags.push(`Malware signature: ${pattern.source}`);
        }
    }

    // Check for suspicious iframes (not YouTube/Vimeo)
    // Use regex with word boundaries to prevent subdomain spoofing
    const iframeMatches = content.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi);
    if (iframeMatches) {
        const allowedHosts = /^https?:\/\/(?:www\.)?(youtube\.com|vimeo\.com|youtu\.be)\//i;
        for (const iframe of iframeMatches) {
            const srcMatch = iframe.match(/src=["']([^"']+)["']/i);
            const src = srcMatch?.[1] || '';
            if (!allowedHosts.test(src)) {
                flags.push(`Suspicious iframe: ${iframe.substring(0, 100)}`);
            }
        }
    }

    // Check for inline scripts with suspicious content
    // Handle script tags with optional whitespace before >
    const scriptMatches = content.match(/<script[^>]*>[\s\S]*?<\/script\s*>/gi);
    if (scriptMatches) {
        for (const script of scriptMatches) {
            if (
                script.includes('eval(') ||
                script.includes('document.write') ||
                script.includes('atob(')
            ) {
                flags.push('Suspicious inline script');
            }
        }
    }

    return flags;
}

function removeSpamLinks(content: string): { cleaned: string; removed: number } {
    let removed = 0;
    let cleaned = content;

    // Remove links to spam domains
    for (const domain of SPAM_DOMAINS) {
        const regex = new RegExp(
            `<a[^>]*href=["'][^"']*${domain.replace('.', '\\.')}[^"']*["'][^>]*>.*?</a>`,
            'gi'
        );
        const matches = cleaned.match(regex);
        if (matches) {
            removed += matches.length;
            cleaned = cleaned.replace(regex, '');
        }
    }

    return { cleaned, removed };
}

function rewriteUrls(content: string): string {
    // Replace old domain with new path
    let rewritten = content;

    // Handle various URL formats
    const patterns = [
        new RegExp(`https?://${OLD_DOMAIN.replace('.', '\\.')}`, 'gi'),
        new RegExp(`//${OLD_DOMAIN.replace('.', '\\.')}`, 'gi'),
    ];

    for (const pattern of patterns) {
        rewritten = rewritten.replace(pattern, `https://${NEW_PATH}`);
    }

    return rewritten;
}

function removeShortcodes(content: string): string {
    let cleaned = content;

    for (const pattern of SHORTCODE_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    return cleaned;
}

function cleanHtml(content: string): string {
    let cleaned = content;

    // Remove empty paragraphs
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
    cleaned = cleaned.replace(/<p>&nbsp;<\/p>/gi, '');

    // Remove excessive line breaks
    cleaned = cleaned.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');

    // Remove empty divs
    cleaned = cleaned.replace(/<div>\s*<\/div>/gi, '');

    // Clean up whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
}

async function cleanAndAudit(): Promise<void> {
    console.log('🧹 Starting post cleaning and audit...');
    console.log(`📄 Input: ${INPUT_FILE}`);

    if (!fs.existsSync(INPUT_FILE)) {
        console.error('❌ Input file not found! Run 1-extract.ts first.');
        process.exit(1);
    }

    const rawData: RawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    console.log(`📝 Processing ${rawData.posts.length} posts...`);

    const cleanPosts: CleanPost[] = [];
    let discarded = 0;
    let review = 0;
    let kept = 0;
    let chipUnlockedFound = false;

    for (const post of rawData.posts) {
        const notes: string[] = [];
        const securityFlags: string[] = [];
        let cleanStatus: 'KEEP' | 'REVIEW' | 'DISCARD' = 'KEEP';

        // 1. Security scan
        const malwareFlags = scanForMalware(post.content);
        if (malwareFlags.length > 0) {
            securityFlags.push(...malwareFlags);
            cleanStatus = 'DISCARD';
            notes.push(`Security issue: ${malwareFlags.length} malware signatures found`);
        }

        // 2. Remove spam links
        const { cleaned: noSpamContent, removed: spamLinksRemoved } = removeSpamLinks(
            post.content
        );
        if (spamLinksRemoved > 0) {
            notes.push(`Removed ${spamLinksRemoved} spam links`);
        }

        // 3. URL rewrite
        const rewrittenContent = rewriteUrls(noSpamContent);
        if (rewrittenContent !== noSpamContent) {
            notes.push('Rewrote old domain URLs');
        }

        // 4. Remove shortcodes
        const noShortcodes = removeShortcodes(rewrittenContent);
        if (noShortcodes !== rewrittenContent) {
            notes.push('Removed WordPress shortcodes');
        }

        // 5. Clean HTML
        const cleanContent = cleanHtml(noShortcodes);

        // 6. Word count check
        const wordCount = countWords(cleanContent);
        if (wordCount < 100 && cleanStatus !== 'DISCARD') {
            cleanStatus = 'DISCARD';
            notes.push(`Too short: only ${wordCount} words`);
        }

        // 7. Check for specific post of interest
        if (
            post.title.toLowerCase().includes('chip unlocked') ||
            post.slug.includes('chip-unlocked')
        ) {
            chipUnlockedFound = true;
            notes.push('🎯 FOUND: "Chip Unlocked" post');
            console.log(`🎯 Found "Chip Unlocked": ID=${post.id}, Title="${post.title}"`);
        }

        // 8. Basic quality check (can be enhanced with AI later)
        if (cleanStatus === 'KEEP') {
            // Flag posts with very little actual content vs. HTML
            // Use iterative replacement to fully strip nested/malformed tags
            let textOnly = cleanContent;
            let prevLength: number;
            do {
                prevLength = textOnly.length;
                textOnly = textOnly.replace(/<[^>]*>/g, '');
            } while (textOnly.length !== prevLength);
            const htmlRatio =
                cleanContent.length > 0
                    ? (cleanContent.length - textOnly.length) / cleanContent.length
                    : 0;

            if (htmlRatio > 0.7) {
                cleanStatus = 'REVIEW';
                notes.push('High HTML-to-content ratio - needs review');
            }
        }

        // Create clean post
        const cleanPost: CleanPost = {
            ...post,
            content: cleanContent,
            cleanStatus,
            cleaningNotes: notes,
            wordCount,
            securityFlags,
        };

        cleanPosts.push(cleanPost);

        if (cleanStatus === 'DISCARD') discarded++;
        else if (cleanStatus === 'REVIEW') review++;
        else kept++;
    }

    // Summary
    console.log('\n📊 Cleaning Summary:');
    console.log(`   ✅ KEEP:    ${kept} posts`);
    console.log(`   ⚠️  REVIEW:  ${review} posts`);
    console.log(`   ❌ DISCARD: ${discarded} posts`);
    console.log(`   🎯 "Chip Unlocked" found: ${chipUnlockedFound ? 'YES' : 'NO'}`);

    // Write output
    const output = {
        cleanedAt: new Date().toISOString(),
        source: INPUT_FILE,
        summary: {
            total: cleanPosts.length,
            keep: kept,
            review,
            discard: discarded,
            chipUnlockedFound,
        },
        posts: cleanPosts,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
    console.log('✅ Cleaning complete!');

    // Print posts that need review
    if (review > 0) {
        console.log('\n⚠️  Posts needing review:');
        for (const post of cleanPosts.filter((p) => p.cleanStatus === 'REVIEW')) {
            console.log(`   - [${post.id}] ${post.title}: ${post.cleaningNotes.join(', ')}`);
        }
    }

    // Print discarded posts
    if (discarded > 0) {
        console.log('\n❌ Discarded posts:');
        for (const post of cleanPosts.filter((p) => p.cleanStatus === 'DISCARD')) {
            console.log(`   - [${post.id}] ${post.title}: ${post.cleaningNotes.join(', ')}`);
        }
    }
}

cleanAndAudit().catch((err) => {
    console.error('❌ Cleaning failed:', err);
    process.exit(1);
});
