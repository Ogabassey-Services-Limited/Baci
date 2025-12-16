/**
 * Migration Script: Convert Markdown Descriptions to Sanitized HTML
 * 
 * Koray-aligned approach:
 * - Pre-render markdown to HTML server-side
 * - Store sanitized HTML in database
 * - Zero client-side processing cost
 */

import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configure marked for semantic HTML output
marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
});

// Sanitize HTML while preserving semantic tags
const sanitizeHtml = (html: string): string => {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'br', 'hr',
            'ul', 'ol', 'li',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'strong', 'em', 'b', 'i', 'u',
            'a', 'span', 'div',
            'blockquote', 'pre', 'code',
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    });
};

// Check if content looks like markdown
const isMarkdown = (text: string): boolean => {
    const markdownPatterns = [
        /^#{1,6}\s/m,           // Headers
        /\*\*[^*]+\*\*/,        // Bold
        /\|.*\|.*\|/,           // Tables
        /^\s*[-*]\s/m,          // Lists
        /^\s*\d+\.\s/m,         // Numbered lists
    ];
    return markdownPatterns.some(pattern => pattern.test(text));
};

async function migrateDescriptions() {
    console.log('=== Markdown → HTML Migration ===\n');

    let converted = 0;
    let skipped = 0;
    let errors = 0;
    let offset = 0;
    const batchSize = 500;

    while (true) {
        // Fetch products with descriptions in batches
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, description')
            .not('description', 'is', null)
            .neq('description', '')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('Error fetching products:', error.message);
            return;
        }

        if (!products || products.length === 0) {
            break; // No more products
        }

        console.log(`Processing batch ${offset / batchSize + 1} (${products.length} products)...`);

        for (const product of products) {
            const desc = product.description;

            // Skip if already HTML or not markdown
            if (desc.startsWith('<') || !isMarkdown(desc)) {
                skipped++;
                continue;
            }

            try {
                // Convert markdown to HTML
                const rawHtml = await marked.parse(desc);
                const cleanHtml = sanitizeHtml(rawHtml);

                // Update database
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ description: cleanHtml })
                    .eq('id', product.id);

                if (updateError) {
                    console.error(`Error updating ${product.name}:`, updateError.message);
                    errors++;
                } else {
                    converted++;
                }
            } catch (e) {
                console.error(`Parse error for ${product.name}:`, e);
                errors++;
            }
        }

        offset += batchSize;
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Converted: ${converted}`);
    console.log(`Skipped (already HTML or plain text): ${skipped}`);
    console.log(`Errors: ${errors}`);
}

migrateDescriptions();
