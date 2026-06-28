import type { Graph, Thing, WithContext } from 'schema-dts';

export type JsonLdData<T extends Thing = Thing> = WithContext<T>;

export interface JsonLdStructuredData extends Record<string, unknown> {
  '@context': string;
  '@type': string;
}

export interface JsonLdGraphData extends Record<string, unknown> {
  '@context': string;
  '@graph': readonly Record<string, unknown>[];
}

export type JsonLdScriptData =
  | JsonLdData
  | Graph
  | JsonLdStructuredData
  | JsonLdGraphData;
