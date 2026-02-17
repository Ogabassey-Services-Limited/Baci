import { describe, expect, it } from 'vitest';
import { SearchAutocomplete } from './search-autocomplete';

describe('SearchAutocomplete', () => {
  it('exports a valid component', () => {
    expect(SearchAutocomplete).toBeDefined();
    expect(typeof SearchAutocomplete).toBe('function');
  });
});
