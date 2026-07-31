import { describe, expect, it } from 'vitest';
import {
  publishBuilderDraft,
  saveBuilderDraft,
} from './builder-draft-mutations';

describe('builder draft mutations module', () => {
  it('exports the separately covered save and publish mutations', () => {
    expect(saveBuilderDraft).toEqual(expect.any(Function));
    expect(publishBuilderDraft).toEqual(expect.any(Function));
  });
});
