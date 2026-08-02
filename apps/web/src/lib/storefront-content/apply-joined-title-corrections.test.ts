import { describe, expect, it } from 'vitest';
import { applyJoinedTitleCorrections } from './apply-joined-title-corrections';

describe('applyJoinedTitleCorrections', () => {
  it('expands configured joined titles without changing unrelated text', () => {
    expect(applyJoinedTitleCorrections('donkeykong switch')).toBe(
      'donkey kong switch'
    );
    expect(applyJoinedTitleCorrections('donkeykongx switch')).toBe(
      'donkeykongx switch'
    );
  });
});
