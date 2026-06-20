import type { Graph, Thing, WithContext } from 'schema-dts';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';

export type JsonLdData<T extends Thing = Thing> = WithContext<T> | Graph;

type JsonLdSerializableData = JsonLdData | Record<string, unknown>;

interface JsonLdProps {
  data: JsonLdSerializableData;
}

/**
 * Renders a script tag with valid JSON-LD structured data.
 * Adheres to Google's rigorous Rich Result testing standards.
 */
export function JsonLd({ data }: JsonLdProps) {
  if (!data) return null;
  return (
    <script type="application/ld+json">{safeJsonLdStringify(data)}</script>
  );
}
