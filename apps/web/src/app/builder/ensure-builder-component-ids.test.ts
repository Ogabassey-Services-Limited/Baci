import type { Data } from '@puckeditor/core';
import { describe, expect, it, vi } from 'vitest';
import { ensureBuilderComponentIds } from './ensure-builder-component-ids';

describe('ensureBuilderComponentIds', () => {
  it('preserves existing ids and assigns stable unique ids to missing ones', () => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
    const data = {
      content: [
        { type: 'Header', props: { id: 'existing' } },
        { type: 'Text', props: { text: 'Hello' } },
      ],
      root: { title: 'Home' },
      zones: {},
    } as Data;

    expect(ensureBuilderComponentIds(data).content).toEqual([
      { type: 'Header', props: { id: 'existing' } },
      { type: 'Text', props: { text: 'Hello', id: 'Text-42-1' } },
    ]);
  });
});
