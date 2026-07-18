import { describe, expect, it } from 'vitest';
import { configLoadCount } from './analytics-delivery-config-load-count';

describe('configLoadCount', () => {
  it('counts direct and locally aliased configuration loads', () => {
    const source =
      "import { fetchAnalyticsPlatformConfig } from './fetch-analytics-platform-config'; const load = fetchAnalyticsPlatformConfig; fetchAnalyticsPlatformConfig(client, id); load(client, id);";
    expect(
      configLoadCount('route.ts', source, ['./fetch-analytics-platform-config'])
    ).toBe(2);
  });
});
