import { describe, expect, it } from 'vitest';
import { defineArchiveRouteAuthorizationSuite } from './archive-route-authorization.test-suite';

describe('archive route authorization test suite', () => {
  it('exports the focused suite registrar', () => {
    expect(defineArchiveRouteAuthorizationSuite).toEqual(expect.any(Function));
  });
});
