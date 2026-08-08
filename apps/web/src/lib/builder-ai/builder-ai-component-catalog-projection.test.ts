import { describe, expect, it } from 'vitest';
import { getBuilderAiCatalogProjection } from './builder-ai-component-catalog-projection';

describe('getBuilderAiCatalogProjection', () => {
  it('projects protected status and constrained properties without defaults', () => {
    const header = getBuilderAiCatalogProjection().find(
      (item) => item.componentType === 'Header'
    );

    expect(header).toMatchObject({ insertable: false, protected: true });
    expect(header?.editableProps).toContainEqual(
      expect.objectContaining({ name: 'layout' })
    );
  });
});
