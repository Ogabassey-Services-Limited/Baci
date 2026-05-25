// Metro does not expose these resolver types for its JS config, so mirror only the tested shape.
type MetroResolution = {
  filePath: string;
  type: string;
};

type MetroResolver = (
  context: { resolveRequest: jest.Mock },
  moduleName: string,
  platform: string | null
) => MetroResolution;

const metroConfig = jest.requireActual<{
  resolver: { resolveRequest?: MetroResolver };
}>('./metro.config.js');

function getResolver(): MetroResolver {
  const resolveRequest = metroConfig.resolver.resolveRequest;

  expect(resolveRequest).toEqual(expect.any(Function));
  if (!resolveRequest) {
    throw new Error('Expected Metro to define a custom dependency resolver.');
  }

  return resolveRequest;
}

describe('Metro web runtime resolution', () => {
  it('resolves Zustand middleware to its classic-script-safe build on web', () => {
    const fallbackResolve = jest.fn<MetroResolution, []>(() => ({
      filePath: '/fallback.js',
      type: 'sourceFile',
    }));

    const resolution = getResolver()(
      { resolveRequest: fallbackResolve },
      'zustand/middleware',
      'web'
    );

    expect(resolution).toEqual({
      filePath: require.resolve('zustand/middleware'),
      type: 'sourceFile',
    });
    expect(fallbackResolve).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android'])(
    'preserves default Zustand middleware resolution on %s',
    (platform) => {
      const fallbackResolution = {
        filePath: '/fallback.js',
        type: 'sourceFile',
      };
      const fallbackResolve = jest.fn(() => fallbackResolution);

      const resolution = getResolver()(
        { resolveRequest: fallbackResolve },
        'zustand/middleware',
        platform
      );

      expect(resolution).toBe(fallbackResolution);
      expect(fallbackResolve).toHaveBeenCalledWith(
        expect.any(Object),
        'zustand/middleware',
        platform
      );
    }
  );

  it('preserves default resolution for unrelated web modules', () => {
    const fallbackResolution = {
      filePath: '/fallback.js',
      type: 'sourceFile',
    };
    const fallbackResolve = jest.fn(() => fallbackResolution);

    const resolution = getResolver()(
      { resolveRequest: fallbackResolve },
      'react',
      'web'
    );

    expect(resolution).toBe(fallbackResolution);
    expect(fallbackResolve).toHaveBeenCalledWith(
      expect.any(Object),
      'react',
      'web'
    );
  });
});
