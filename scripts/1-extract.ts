/**
 * 1-extract.ts - Extract WordPress posts from SQL dump to JSON
 *
 * Usage: npx tsx scripts/1-extract.ts
 *
 * Input:  /Users/mac/Desktop/blog_database.sql
 * Output: scripts/data/posts-raw.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

// Configuration
const SQL_FILE = '/Users/mac/Desktop/blog_database.sql';
const OUTPUT_FILE = path.join(import.meta.dirname, 'data', 'posts-raw.json');
const UPLOADS_TAR = '/Users/mac/Desktop/blog_uploads.tar.gz';

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
    featuredImageId?: number;
    featuredImagePath?: string;
    categories: string[];
    tags: string[];
}

interface PostMeta {
    postId: number;
    metaKey: string;
    metaValue: string;
}

interface Attachment {
    id: number;
    filePath: string;
}

// Regex patterns for parsing MySQL INSERT statements
const POST_INSERT_REGEX = /INSERT INTO `wpgo_posts` VALUES\s*(.+);/;
const POSTMETA_INSERT_REGEX = /INSERT INTO `wpgo_postmeta` VALUES\s*(.+);/;

// Parse a MySQL values row - handles escaped quotes and commas
function parseValues(valuesStr: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuote = false;
    let escaped = false;
    let depth = 0;
    let currentRow: string[] = [];
    let currentValue = '';

    for (let i = 0; i < valuesStr.length; i++) {
        const char = valuesStr[i];

        if (escaped) {
            currentValue += char;
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            currentValue += char;
            continue;
        }

        if (char === "'" && !inQuote) {
            inQuote = true;
            continue;
        }

        if (char === "'" && inQuote) {
            // Check for escaped quote ''
            if (valuesStr[i + 1] === "'") {
                currentValue += "'";
                i++;
                continue;
            }
            inQuote = false;
            continue;
        }

        if (inQuote) {
            currentValue += char;
            continue;
        }

        if (char === '(') {
            depth++;
            if (depth === 1) {
                currentRow = [];
                currentValue = '';
                continue;
            }
        }

        if (char === ')') {
            depth--;
            if (depth === 0) {
                currentRow.push(currentValue.trim());
                rows.push(currentRow);
                currentValue = '';
                continue;
            }
        }

        if (char === ',' && depth === 1) {
            currentRow.push(currentValue.trim());
            currentValue = '';
            continue;
        }

        if (depth >= 1) {
            currentValue += char;
        }
    }

    return rows;
}

async function extractPosts(): Promise<void> {
    console.log('🚀 Starting WordPress SQL extraction...');
    console.log(`📄 Source: ${SQL_FILE}`);

    if (!fs.existsSync(SQL_FILE)) {
        console.error('❌ SQL file not found!');
        process.exit(1);
    }

    const posts: Map<number, RawPost> = new Map();
    const postMeta: PostMeta[] = [];
    const attachments: Map<number, string> = new Map();

    // Read file line by line
    const fileStream = fs.createReadStream(SQL_FILE, { encoding: 'utf8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Number.POSITIVE_INFINITY,
    });

    let lineCount = 0;
    let inPostsInsert = false;
    let inPostmetaInsert = false;
    let accumulatedLine = '';

    console.log('📖 Reading SQL file...');

    for await (const line of rl) {
        lineCount++;

        if (lineCount % 10000 === 0) {
            console.log(`  ... processed ${lineCount} lines`);
        }

        // Check for INSERT INTO wpgo_posts
        if (line.includes('INSERT INTO `wpgo_posts`')) {
            inPostsInsert = true;
            accumulatedLine = line;
        } else if (inPostsInsert) {
            accumulatedLine += line;
        }

        // Check for INSERT INTO wpgo_postmeta
        if (line.includes('INSERT INTO `wpgo_postmeta`')) {
            inPostmetaInsert = true;
            accumulatedLine = line;
        } else if (inPostmetaInsert && !inPostsInsert) {
            accumulatedLine += line;
        }

        // Process complete INSERT statement
        if (inPostsInsert && line.includes(';')) {
            inPostsInsert = false;
            const match = accumulatedLine.match(POST_INSERT_REGEX);
            if (match) {
                const rows = parseValues(match[1]);
                for (const row of rows) {
                    // WordPress posts table columns:
                    // ID, post_author, post_date, post_date_gmt, post_content, post_title,
                    // post_excerpt, post_status, comment_status, ping_status, post_password,
                    // post_name (slug), to_ping, pinged, post_modified, post_modified_gmt,
                    // post_content_filtered, post_parent, guid, menu_order, post_type, ...
                    const id = Number.parseInt(row[0], 10);
                    const postType = row[20] || 'post';
                    const postStatus = row[7] || 'draft';

                    // Only extract published posts and attachments
                    if (postType === 'post' && postStatus === 'publish') {
                        posts.set(id, {
                            id,
                            title: row[5] || '',
                            slug: row[11] || '',
                            content: row[4] || '',
                            excerpt: row[6] || '',
                            status: postStatus,
                            postType,
                            publishedAt: row[2] || '',
                            authorId: Number.parseInt(row[1], 10) || 1,
                            categories: [],
                            tags: [],
                        });
                    }

                    // Track attachments for featured images
                    if (postType === 'attachment') {
                        const guid = row[18] || '';
                        const filePath = guid.replace(/^https?:\/\/[^/]+/, '');
                        attachments.set(id, filePath);
                    }
                }
            }
            accumulatedLine = '';
        }

        // Process complete postmeta INSERT statement
        if (inPostmetaInsert && line.includes(';') && !inPostsInsert) {
            inPostmetaInsert = false;
            const match = accumulatedLine.match(POSTMETA_INSERT_REGEX);
            if (match) {
                const rows = parseValues(match[1]);
                for (const row of rows) {
                    // postmeta columns: meta_id, post_id, meta_key, meta_value
                    const metaKey = row[2] || '';
                    if (metaKey === '_thumbnail_id' || metaKey === '_wp_attached_file') {
                        postMeta.push({
                            postId: Number.parseInt(row[1], 10),
                            metaKey,
                            metaValue: row[3] || '',
                        });
                    }
                }
            }
            accumulatedLine = '';
        }
    }

    console.log(`✅ Parsed ${lineCount} lines`);
    console.log(`📝 Found ${posts.size} published posts`);
    console.log(`🖼️  Found ${attachments.size} attachments`);

    // Link featured images to posts
    for (const meta of postMeta) {
        if (meta.metaKey === '_thumbnail_id') {
            const post = posts.get(meta.postId);
            if (post) {
                post.featuredImageId = Number.parseInt(meta.metaValue, 10);
                const attachmentPath = attachments.get(post.featuredImageId);
                if (attachmentPath) {
                    post.featuredImagePath = attachmentPath;
                }
            }
        }
    }

    // Count posts with featured images
    let postsWithImages = 0;
    for (const post of posts.values()) {
        if (post.featuredImagePath) {
            postsWithImages++;
        }
    }
    console.log(`🖼️  ${postsWithImages} posts have featured images`);

    // Write output
    const output = {
        extractedAt: new Date().toISOString(),
        source: SQL_FILE,
        uploadsArchive: UPLOADS_TAR,
        postCount: posts.size,
        posts: Array.from(posts.values()),
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    console.log(`💾 Saved to: ${OUTPUT_FILE}`);
    console.log('✅ Extraction complete!');
}

extractPosts().catch((err) => {
    console.error('❌ Extraction failed:', err);
    process.exit(1);
});
