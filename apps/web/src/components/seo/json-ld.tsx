import type { ReactElement } from 'react';
import type { Graph, Thing, WithContext } from 'schema-dts';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';

export type JsonLdData<T extends Thing = Thing> = WithContext<T>;

interface JsonLdProps<T extends Thing = Thing> {
  data: JsonLdData<T>;
}

interface JsonLdGraphProps {
  data: Graph;
}

/**
 * Renders a script tag with valid JSON-LD structured data.
 * Adheres to Google's rigorous Rich Result testing standards.
 */
export function JsonLd<T extends Thing = Thing>(
  props: JsonLdProps<T>
): ReactElement | null;
export function JsonLd(props: JsonLdGraphProps): ReactElement | null;
export function JsonLd<T extends Thing = Thing>({
  data,
}: JsonLdProps<T> | JsonLdGraphProps): ReactElement | null {
  if (!data) return null;
  return (
    <script type="application/ld+json">{safeJsonLdStringify(data)}</script>
  );
}
