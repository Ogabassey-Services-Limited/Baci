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

  it('publishes string limits for primitive, URL, and nested fields', () => {
    const projection = getBuilderAiCatalogProjection();
    const hero = projection.find((item) => item.componentType === 'Hero');
    const header = projection.find((item) => item.componentType === 'Header');

    expect(hero?.editableProps).toContainEqual(
      expect.objectContaining({ maximumLength: 120, name: 'title' })
    );
    expect(hero?.editableProps).toContainEqual(
      expect.objectContaining({ maximumLength: 512, name: 'ctaLink' })
    );
    expect(header?.editableProps).toContainEqual(
      expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({ maximumLength: 120, name: 'label' }),
          expect.objectContaining({ maximumLength: 512, name: 'url' }),
        ]),
        name: 'navigationLinks',
      })
    );
  });
});
