import type { ReactElement } from 'react';
import type { Graph, Thing, WithContext } from 'schema-dts';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';

export type JsonLdData<T extends Thing = Thing> = WithContext<T>;

export interface JsonLdStructuredData {
  [property: string]: unknown;
}

export type JsonLdScriptData = JsonLdData | Graph | JsonLdStructuredData;

interface JsonLdProps {
  data: JsonLdScriptData | null | undefined;
}

/**
 * Renders a script tag with valid JSON-LD structured data.
 * Adheres to Google's rigorous Rich Result testing standards.
 */
export function JsonLd({ data }: JsonLdProps): ReactElement | null {
  if (data == null) return null;
  return (
    <script type="application/ld+json">{safeJsonLdStringify(data)}</script>
  );
}
