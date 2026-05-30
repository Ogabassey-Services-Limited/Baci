import type { Thing, WithContext } from 'schema-dts';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';

interface JsonLdProps<T extends Thing> {
  data: WithContext<T>;
}

/**
 * Renders a script tag with valid JSON-LD structured data.
 * Adheres to Google's rigorous Rich Result testing standards.
 */
export function JsonLd<T extends Thing>({ data }: JsonLdProps<T>) {
  return (
    <script type="application/ld+json">{safeJsonLdStringify(data)}</script>
  );
}
