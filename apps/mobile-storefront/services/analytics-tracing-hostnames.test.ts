import { describe, expect, it } from '@jest/globals';
import { buildAnalyticsTracingHostnames } from './analytics-tracing-hostnames';

describe('analytics tracing hostnames', () => {
  it('limits tracing headers to Baci and merchant API hosts', () => {
    expect(
      buildAnalyticsTracingHostnames({
        apiUrl: 'https://api.usebaci.com/v1',
        merchantDomain: 'www.ogabassey.com/storefront',
      })
    ).toEqual([
      'usebaci.com',
      'www.usebaci.com',
      'api.usebaci.com',
      'www.ogabassey.com',
    ]);
  });

  it('deduplicates malformed or repeated host values', () => {
    expect(
      buildAnalyticsTracingHostnames({
        apiUrl: 'usebaci.com',
        merchantDomain: 'https://:443',
      })
    ).toEqual(['usebaci.com', 'www.usebaci.com']);
  });

  it('ignores blank and non-string host inputs', () => {
    expect(
      buildAnalyticsTracingHostnames({
        apiUrl: undefined,
        merchantDomain: '   ',
      })
    ).toEqual(['usebaci.com', 'www.usebaci.com']);

    expect(
      buildAnalyticsTracingHostnames({
        apiUrl: 123,
        merchantDomain: null,
      })
    ).toEqual(['usebaci.com', 'www.usebaci.com']);
  });

  it('drops scheme-less invalid hostnames', () => {
    expect(
      buildAnalyticsTracingHostnames({
        apiUrl: 'foo bar',
        merchantDomain: 'ogabassey.com',
      })
    ).toEqual(['usebaci.com', 'www.usebaci.com', 'ogabassey.com']);
  });

  it('ignores relative URL fragments and paths', () => {
    expect(
      buildAnalyticsTracingHostnames({
        apiUrl: '/api',
        merchantDomain: '?storefront=1',
      })
    ).toEqual(['usebaci.com', 'www.usebaci.com']);

    expect(
      buildAnalyticsTracingHostnames({
        apiUrl: '#fragment',
        merchantDomain: 'usebaci.com/storefront',
      })
    ).toEqual(['usebaci.com', 'www.usebaci.com']);
  });
});
