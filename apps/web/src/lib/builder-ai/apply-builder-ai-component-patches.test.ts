import type { BuilderData } from '@baci/shared/contracts';
import { describe, expect, it } from 'vitest';
import {
  applyBuilderAiCarouselPatch,
  applyBuilderAiComponentPatch,
} from './apply-builder-ai-component-patches';

describe('applyBuilderAiComponentPatch', () => {
  it('reports a no-op instead of assigning an unchanged prop', () => {
    const component: BuilderData['content'][number] = {
      props: { id: 'text-1', title: 'Same' },
      type: 'Text',
    };

    expect(
      applyBuilderAiComponentPatch(component, {
        componentType: 'Text',
        title: 'Same',
      })
    ).toContain('No safe changes for Text.');
  });
});

describe('applyBuilderAiCarouselPatch', () => {
  it('updates only the selected safe slide fields', () => {
    const component: BuilderData['content'][number] = {
      props: { id: 'carousel-1', slides: [{ title: 'Before', image: 'keep' }] },
      type: 'HeroCarousel',
    };

    applyBuilderAiCarouselPatch(
      component,
      {
        componentId: 'carousel-1',
        kind: 'update_carousel_slide',
        slideIndex: 0,
        title: 'After',
      },
      (message) => new Error(message)
    );

    expect(component.props.slides).toEqual([{ title: 'After', image: 'keep' }]);
  });
});
