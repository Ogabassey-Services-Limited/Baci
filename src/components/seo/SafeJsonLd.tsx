/**
 * SafeJsonLd Component
 *
 * A secure wrapper for rendering JSON-LD structured data in script tags.
 * This component addresses Semgrep security warnings about dangerouslySetInnerHTML
 * by providing documented sanitization and defense-in-depth measures.
 *
 * Security measures:
 * 1. JSON.stringify() escapes special characters in strings
 * 2. Additional sanitization removes any script-breaking sequences
 * 3. Content-type is set to application/ld+json (not executable)
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
 */

import React from 'react';

interface SafeJsonLdProps {
    /** The schema.org structured data object to render */
    schema: Record<string, unknown>;
    /** Optional test ID for testing purposes */
    testId?: string;
}

/**
 * Sanitizes a JSON-LD string to prevent XSS attacks.
 * Even though JSON.stringify escapes quotes, we add extra protection
 * against script tag injection attempts.
 */
function sanitizeJsonLdString(jsonString: string): string {
    // Replace </script with a safe Unicode equivalent to prevent
    // breaking out of the script tag context
    return jsonString
        .replace(/<\/script/gi, '\\u003c/script')
        .replace(/<!--/g, '\\u003c!--');
}

/**
 * SafeJsonLd - Renders JSON-LD structured data safely
 *
 * This component is designed to be used for schema.org structured data
 * that has already been sanitized by the seo-utils functions.
 * It adds an additional layer of protection as defense-in-depth.
 *
 * @example
 * ```tsx
 * <SafeJsonLd schema={productSchema} />
 * ```
 */
export function SafeJsonLd({ schema, testId }: SafeJsonLdProps): React.ReactElement {
    // Convert schema to JSON string with sanitization
    const jsonString = sanitizeJsonLdString(JSON.stringify(schema));

    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
    // Security: This is safe because:
    // 1. Input schemas are pre-sanitized by seo-utils functions using escapeHtml()
    // 2. JSON.stringify() escapes all special characters in string values
    // 3. sanitizeJsonLdString() prevents </script> injection
    // 4. Content-Type application/ld+json is not executed by browsers
    return (
        <script
            type="application/ld+json"
            data-testid={testId}
            dangerouslySetInnerHTML={{ __html: jsonString }}
        />
    );
}

export default SafeJsonLd;
