import { describe, expect, it } from 'vitest';
import {
  getBuilderMutationErrorMessage,
  getDegradedBuilderDescription,
  getReadOnlyBuilderDescription,
} from './builder-descriptions';

describe('builder descriptions', () => {
  it('returns copy for degraded builder reasons', () => {
    expect(getDegradedBuilderDescription('config_load_failed')).toBe(
      'We could not load the latest builder draft from the server. Refresh to resume editing once the connection stabilizes.'
    );
    expect(getDegradedBuilderDescription('default_generation_failed')).toBe(
      'We could not generate a safe fallback template for this store. Refresh later before making changes.'
    );
    expect(getDegradedBuilderDescription(null)).toBe(
      'This builder session is read-only until the latest draft can be loaded again.'
    );
  });

  it('normalizes builder mutation errors', () => {
    expect(
      getBuilderMutationErrorMessage(
        new Error('Builder draft is out of date'),
        'fallback'
      )
    ).toBe(
      'This page changed in another session. Refresh the builder to continue with the latest version.'
    );
    expect(getBuilderMutationErrorMessage(new Error('Boom'), 'fallback')).toBe(
      'Boom'
    );
    expect(getBuilderMutationErrorMessage('Boom', 'fallback')).toBe('fallback');
    expect(getBuilderMutationErrorMessage(undefined, 'fallback')).toBe(
      'fallback'
    );
  });

  it('uses AI draft copy for read-only AI previews', () => {
    expect(getReadOnlyBuilderDescription('ai_draft', null)).toBe(
      'You are previewing an AI-generated storefront draft. Apply it to replace the current starter draft, or return to the dashboard to keep editing manually.'
    );
  });

  it('delegates non-AI read-only copy to degraded reasons', () => {
    expect(getReadOnlyBuilderDescription(null, 'config_load_failed')).toBe(
      getDegradedBuilderDescription('config_load_failed')
    );
  });
});
