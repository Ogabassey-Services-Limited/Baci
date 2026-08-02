import { getKeySpecCategoriesForFamily } from './spec-category-families';
import type { ProductSpecSection } from './spec-data';
import type {
  ComparableProductKeySpecs,
  ProductSpecFamily,
} from './spec-taxonomy';

export function buildDetailedSpecsFromKeySpecs(
  keySpecs: ComparableProductKeySpecs,
  family: ProductSpecFamily
): ProductSpecSection[] {
  return getKeySpecCategoriesForFamily(family)
    .map(({ category, fields }) => ({
      category,
      items: fields
        .filter(({ key, condition }) => {
          const value = keySpecs[key];
          return (
            value !== null &&
            value !== undefined &&
            (typeof value !== 'string' || value.trim().length > 0) &&
            (!condition || condition(keySpecs))
          );
        })
        .map((field) => {
          const value = keySpecs[field.key];
          return {
            label: field.dynamicLabel
              ? field.dynamicLabel(keySpecs)
              : field.label,
            value: field.transform
              ? field.transform(value, keySpecs)
              : String(value),
          };
        }),
    }))
    .filter((section) => section.items.length > 0);
}
