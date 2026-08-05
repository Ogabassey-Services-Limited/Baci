import type { BuilderData } from '@baci/shared/contracts';
import { describe, expect, it } from 'vitest';
import { normalizeBuilderAiComponentIds } from './normalize-builder-ai-component-ids';

describe('normalizeBuilderAiComponentIds', () => {
  it('assigns server ids to editable root and zone components missing props.id', () => {
    const config: BuilderData = {
      content: [{ props: { title: 'Root copy' }, type: 'Text' }],
      root: { title: 'Home' },
      zones: { aside: [{ props: { title: 'Zone copy' }, type: 'Text' }] },
    };
    let sequence = 0;

    const normalized = normalizeBuilderAiComponentIds(
      config,
      (type) => `${type.toLowerCase()}-${++sequence}`
    );

    expect(normalized.content[0]?.props.id).toBe('text-1');
    expect(
      (normalized.zones?.aside as BuilderData['content'])[0]?.props.id
    ).toBe('text-2');
    expect(config.content[0]?.props.id).toBeUndefined();
  });
});
