export interface ParsedCompareSlug {
  leftKey: string;
  rightKey: string;
  canonicalSlug: string;
}

export type ComparePageKind = 'product' | 'brand';

export interface PriceBandDefinition {
  slug: string;
  label: string;
  ceiling: number;
  floor?: number;
}
