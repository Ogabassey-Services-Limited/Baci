import { classifyError, getErrorContent } from './error-boundary-content';

describe('error boundary content helpers', () => {
  it('classifies typed network, auth, and server errors before message matching', () => {
    expect(
      classifyError(
        Object.assign(new Error('ignored'), { code: 'NETWORK_ERROR' })
      )
    ).toBe('network');
    expect(
      classifyError(Object.assign(new Error('ignored'), { code: 'AUTH_ERROR' }))
    ).toBe('auth');
    expect(
      classifyError(
        Object.assign(new Error('ignored'), { code: 'SERVER_ERROR' })
      )
    ).toBe('supabase');
  });

  it('falls back to message-based classification', () => {
    expect(classifyError(new Error('Failed to fetch products'))).toBe(
      'network'
    );
    expect(classifyError(new Error('PostgrestError: PGRST116'))).toBe(
      'supabase'
    );
    expect(classifyError(new Error('Unexpected render error'))).toBe('general');
  });

  it('returns user-facing content for the classified error type', () => {
    expect(getErrorContent('auth')).toMatchObject({
      icon: 'log-in-outline',
      title: 'Session Expired',
      buttonText: 'Sign In',
    });
  });
});
