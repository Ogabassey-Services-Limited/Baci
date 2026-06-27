import { describe, expect, it } from 'vitest';
import { resolveMcpSearchProductCondition } from './product-condition-filter';

describe('resolveMcpSearchProductCondition', () => {
  it('displays the requested condition when the row condition matches directly', () => {
    expect(
      resolveMcpSearchProductCondition(
        {
          available_conditions: ['used', 'open_box'],
          condition: 'new',
        },
        'new'
      )
    ).toBe('new');
  });

  it('displays open_box for a refurbished row condition alias', () => {
    expect(
      resolveMcpSearchProductCondition(
        {
          condition: 'refurbished',
        },
        'open_box'
      )
    ).toBe('open_box');
  });

  it('keeps the row condition when only available_conditions matched the search filter', () => {
    expect(
      resolveMcpSearchProductCondition(
        {
          available_conditions: ['used', 'open_box', 'new'],
          condition: 'used',
        },
        'new'
      )
    ).toBe('used');
  });

  it('keeps the row condition when only a refurbished available condition matched', () => {
    expect(
      resolveMcpSearchProductCondition(
        {
          available_conditions: ['refurbished'],
          condition: 'used',
        },
        'open_box'
      )
    ).toBe('used');
  });

  it('keeps the row condition when only legacy condition offers matched', () => {
    expect(
      resolveMcpSearchProductCondition(
        {
          condition: 'used',
          has_condition_offers: true,
        },
        'new'
      )
    ).toBe('used');
  });

  it('falls back to the base product condition when no requested condition matches', () => {
    expect(
      resolveMcpSearchProductCondition(
        {
          available_conditions: ['used'],
          condition: 'used',
        },
        'new'
      )
    ).toBe('used');
  });

  it('falls back to the base condition when no condition was requested', () => {
    expect(
      resolveMcpSearchProductCondition(
        {
          available_conditions: ['new'],
          condition: 'used',
        },
        undefined
      )
    ).toBe('used');
  });

  it('uses new as the last-resort condition fallback', () => {
    expect(
      resolveMcpSearchProductCondition(
        {
          available_conditions: ['used'],
          condition: null,
        },
        'open_box'
      )
    ).toBe('new');
  });
});
