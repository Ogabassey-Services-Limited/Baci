import { describe, expect, it } from 'vitest';
import {
  createVariantOptionDraft,
  createVariantOptionValueDraft,
  VARIANT_OPTION_NAME_SUGGESTIONS,
} from './variant-builder.helpers';

describe('createVariantOptionDraft', () => {
  it('creates a draft with the given name and an empty values array', () => {
    const draft = createVariantOptionDraft('Color');

    expect(draft.name).toBe('Color');
    expect(draft.values).toEqual([]);
    expect(typeof draft.id).toBe('string');
    expect(draft.id.length).toBeGreaterThan(0);
  });

  it('defaults to an empty name when none is provided', () => {
    const draft = createVariantOptionDraft();

    expect(draft.name).toBe('');
    expect(draft.values).toEqual([]);
  });

  it('generates a unique id on every call', () => {
    const first = createVariantOptionDraft('Color');
    const second = createVariantOptionDraft('Storage');
    const third = createVariantOptionDraft('Color');

    expect(first.id).not.toBe(second.id);
    expect(first.id).not.toBe(third.id);
    expect(second.id).not.toBe(third.id);
  });
});

describe('createVariantOptionValueDraft', () => {
  it('creates a value draft with the given value', () => {
    const draft = createVariantOptionValueDraft('Black');

    expect(draft.value).toBe('Black');
    expect(typeof draft.id).toBe('string');
    expect(draft.id.length).toBeGreaterThan(0);
  });

  it('defaults to an empty value when none is provided', () => {
    const draft = createVariantOptionValueDraft();

    expect(draft.value).toBe('');
  });

  it('generates a unique id on every call', () => {
    const first = createVariantOptionValueDraft('Black');
    const second = createVariantOptionValueDraft('White');
    const third = createVariantOptionValueDraft('Black');

    expect(first.id).not.toBe(second.id);
    expect(first.id).not.toBe(third.id);
    expect(second.id).not.toBe(third.id);
  });
});

describe('VARIANT_OPTION_NAME_SUGGESTIONS', () => {
  it('includes the common option names merchants reach for first', () => {
    expect(VARIANT_OPTION_NAME_SUGGESTIONS).toContain('Color');
    expect(VARIANT_OPTION_NAME_SUGGESTIONS).toContain('Storage');
    expect(VARIANT_OPTION_NAME_SUGGESTIONS).toContain('RAM');
    expect(VARIANT_OPTION_NAME_SUGGESTIONS).toContain('Size');
    expect(VARIANT_OPTION_NAME_SUGGESTIONS).toContain('Material');
  });

  it('does not contain unexpected suggestions', () => {
    expect(VARIANT_OPTION_NAME_SUGGESTIONS).toHaveLength(5);
  });
});
