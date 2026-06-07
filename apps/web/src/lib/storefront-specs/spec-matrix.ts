import { buildProductSpecData } from './spec-data';
import type { ComparableProductKeySpecs } from './spec-taxonomy';
import type { VariantAttributeSource } from './variant-attributes';

export interface MatrixProductInput {
  id: string | number;
  name: string;
  brand?: string | null;
  category?: string | null;
  condition?: string | null;
  description?: string | null;
  detailedSpecs?:
    | ReturnType<typeof buildProductSpecData>['detailedSpecs']
    | null;
  product_key_specs?: ComparableProductKeySpecs | null;
  specifications?:
    | { category: string; items: { label: string; value: string }[] }[]
    | null;
  specs?: { label: string; value: string }[] | string | null;
  variant_attributes?: VariantAttributeSource;
}

export interface ProductComparisonMatrixColumn {
  productId: string;
  label: string;
}

export interface ProductComparisonMatrixRow {
  label: string;
  values: string[];
  isDifferent: boolean;
}

export interface ProductComparisonMatrixGroup {
  category: string;
  rows: ProductComparisonMatrixRow[];
}

export interface ProductComparisonMatrix {
  columns: ProductComparisonMatrixColumn[];
  groups: ProductComparisonMatrixGroup[];
  flatRows: ProductComparisonMatrixRow[];
  differentiatingRowCount: number;
}

function uniqueOrdered(values: string[]) {
  return Array.from(new Set(values));
}

export function buildProductComparisonMatrix(input: {
  products: MatrixProductInput[];
}): ProductComparisonMatrix {
  const specData = input.products.map((product) =>
    buildProductSpecData(product)
  );
  const categoryNames = uniqueOrdered(
    specData.flatMap((entry) =>
      entry.detailedSpecs.map((section) => section.category)
    )
  );

  const groups = categoryNames
    .map((category) => {
      const labels = uniqueOrdered(
        specData.flatMap(
          (entry) =>
            entry.detailedSpecs
              .find((section) => section.category === category)
              ?.items.map((item) => item.label) ?? []
        )
      );

      const rows = labels.map((label) => {
        const values = specData.map((entry) => {
          const value = entry.detailedSpecs
            .find((section) => section.category === category)
            ?.items.find((item) => item.label === label)?.value;
          return value || '—';
        });
        const presentValues = values.filter((value) => value !== '—');
        const uniquePresentValues = new Set(presentValues);

        return {
          label,
          values,
          isDifferent:
            uniquePresentValues.size > 1 ||
            (presentValues.length > 0 && values.includes('—')),
        };
      });

      return { category, rows };
    })
    .filter((group) => group.rows.length > 0);

  const flatRows = groups.flatMap((group) => group.rows);

  return {
    columns: input.products.map((product) => ({
      productId: String(product.id),
      label: product.name,
    })),
    groups,
    flatRows,
    differentiatingRowCount: flatRows.filter((row) => row.isDifferent).length,
  };
}
