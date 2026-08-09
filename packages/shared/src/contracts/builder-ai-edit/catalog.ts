import { getManifestComponentSchema } from './manifest-component-schema';

export const productGridPatchSchema = getManifestComponentSchema('edit').refine(
  (value) => value.componentType === 'ProductGrid',
  'Expected a ProductGrid patch'
);

export const insertableComponentSchema = getManifestComponentSchema('insert');
