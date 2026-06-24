import { describe, expect, it } from 'vitest';
import {
  buildDebugBearHeaders,
  buildLegacyPdpLcpJson,
  buildOgaBasseyCwvConfigurationFailures,
  buildOgaBasseyCwvTargets,
  filterOgaBasseyCwvTargets,
  findDebugBearProjectIdForUrl,
  isFalseyEnvValue,
  isTruthyEnvValue,
  loadEnvFile,
  normalizeDebugBearProjects,
} from './measure-ogabassey-cwv-utils.mjs';

describe('env flag helpers', () => {
  it('normalizes common truthy and falsey env values', () => {
    expect(isTruthyEnvValue('YES')).toBe(true);
    expect(isTruthyEnvValue(' on ')).toBe(true);
    expect(isFalseyEnvValue('false')).toBe(true);
    expect(isFalseyEnvValue('off')).toBe(true);
  });
});

describe('buildDebugBearHeaders', () => {
  it('sends a stable user agent with DebugBear API requests', () => {
    expect(buildDebugBearHeaders('key')).toMatchObject({
      'content-type': 'application/json',
      'user-agent': 'Baci-CWV-measurement/1.0',
      'x-api-key': 'key',
    });
  });
});

describe('normalizeDebugBearProjects', () => {
  it('supports DebugBear project arrays and object wrappers', () => {
    const project = { id: '101919', pages: [] };

    expect(normalizeDebugBearProjects([project])).toEqual([project]);
    expect(normalizeDebugBearProjects({ projects: [project] })).toEqual([
      project,
    ]);
    expect(normalizeDebugBearProjects({ items: [project] })).toEqual([project]);
  });
});

describe('findDebugBearProjectIdForUrl', () => {
  const projects = [
    {
      id: '101919',
      pages: [
        { url: 'https://ogabassey.com/', device: { formFactor: 'mobile' } },
        { url: 'https://ogabassey.com/blog', device: { formFactor: 'mobile' } },
      ],
    },
    {
      id: '102065',
      pages: [
        {
          url: 'https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080',
          device: { formFactor: 'mobile' },
        },
      ],
    },
  ];

  it('prefers an exact mobile page project match', () => {
    expect(
      findDebugBearProjectIdForUrl(
        projects,
        'https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080'
      )
    ).toBe('102065');
  });

  it('falls back to the same host project when no exact page exists', () => {
    expect(
      findDebugBearProjectIdForUrl(
        projects,
        'https://ogabassey.com/blog/some-new-article'
      )
    ).toBe('101919');
  });

  it('honors configured desktop device during project discovery', () => {
    expect(
      findDebugBearProjectIdForUrl(
        [
          {
            id: 'mobile-project',
            pages: [
              { url: 'https://ogabassey.com/', device: { name: 'Mobile' } },
            ],
          },
          {
            id: 'desktop-project',
            pages: [
              { url: 'https://ogabassey.com/', device: { name: 'Desktop' } },
            ],
          },
        ],
        'https://ogabassey.com/',
        { deviceName: 'Desktop' }
      )
    ).toBe('desktop-project');
  });

  it('rejects malformed target URLs instead of matching empty origins', () => {
    expect(
      findDebugBearProjectIdForUrl(
        [
          {
            id: 'bad',
            pages: [{ url: null, device: { formFactor: 'mobile' } }],
          },
        ],
        'https://['
      )
    ).toBeNull();
  });

  it('continues scanning when a matched page has no project id', () => {
    expect(
      findDebugBearProjectIdForUrl(
        [
          {
            pages: [
              { url: 'https://ogabassey.com/', device: { name: 'Mobile' } },
            ],
          },
          {
            id: 'valid-project',
            pages: [
              { url: 'https://ogabassey.com/', device: { name: 'Mobile' } },
            ],
          },
        ],
        'https://ogabassey.com/'
      )
    ).toBe('valid-project');
  });
});

describe('buildOgaBasseyCwvTargets', () => {
  it('includes home, PDP, blog index, and blog post targets', () => {
    expect(
      buildOgaBasseyCwvTargets({
        blogPostUrl: 'https://ogabassey.com/blog/post',
      })
    ).toEqual([
      { label: 'home', url: 'https://ogabassey.com/' },
      {
        label: 'pdp-dell',
        url: 'https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080',
      },
      { label: 'blog-index', url: 'https://ogabassey.com/blog' },
      { label: 'blog-post-latest', url: 'https://ogabassey.com/blog/post' },
    ]);
  });

  it('falls back when target URL overrides are blank', () => {
    expect(
      buildOgaBasseyCwvTargets({
        blogUrl: ' ',
        homeUrl: '',
        pdpUrl: '	',
      })
    ).toEqual([
      { label: 'home', url: 'https://ogabassey.com/' },
      {
        label: 'pdp-dell',
        url: 'https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080',
      },
      { label: 'blog-index', url: 'https://ogabassey.com/blog' },
    ]);
  });
});

describe('filterOgaBasseyCwvTargets', () => {
  const targets = buildOgaBasseyCwvTargets({
    blogPostUrl: 'https://ogabassey.com/blog/post',
  });

  it('returns every target when no filter is configured', () => {
    expect(filterOgaBasseyCwvTargets(targets, '')).toEqual(targets);
  });

  it('keeps the documented PDP LCP alias focused on the PDP target', () => {
    expect(filterOgaBasseyCwvTargets(targets, 'pdp-lcp')).toEqual([
      {
        label: 'pdp-dell',
        url: 'https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080',
      },
    ]);
  });

  it('supports the latest-blog-post target alias', () => {
    expect(filterOgaBasseyCwvTargets(targets, 'latest-blog-post')).toEqual([
      { label: 'blog-post-latest', url: 'https://ogabassey.com/blog/post' },
    ]);
  });
});

describe('buildLegacyPdpLcpJson', () => {
  it('preserves legacy PDP LCP identifiers for downstream automation', () => {
    expect(
      buildLegacyPdpLcpJson({
        cls: 0.01,
        device: 'Mobile',
        fcpMs: 1200,
        lcpMs: 2400,
        quickTestId: 'qt-1',
        region: 'us-east',
        resultUrl:
          'https://www.debugbear.com/project/p/quickTest/qt-1/overview',
        tbtMs: 50,
        url: 'https://ogabassey.com/pdp',
      })
    ).toEqual({
      cls: 0.01,
      device: 'Mobile',
      fcpMs: 1200,
      lcpMs: 2400,
      quickTestId: 'qt-1',
      region: 'us-east',
      resultUrl: 'https://www.debugbear.com/project/p/quickTest/qt-1/overview',
      tbtMs: 50,
      url: 'https://ogabassey.com/pdp',
    });
  });
});

describe('buildOgaBasseyCwvConfigurationFailures', () => {
  it('keeps target resolution failures and reports missing providers', () => {
    const failures = buildOgaBasseyCwvConfigurationFailures({
      shouldRunDebugBear: false,
      shouldRunPsi: false,
      targetResolutionFailures: [
        {
          label: 'blog-post-latest',
          message: 'missing blog post',
          source: 'target-resolution',
        },
      ],
      targets: [],
    });

    expect(failures.map((failure) => failure.label)).toEqual([
      'blog-post-latest',
      'measurement',
      'targets',
    ]);
    expect(failures[0]).toMatchObject({ message: 'missing blog post' });
  });

  it('reports explicit DebugBear configuration gaps', () => {
    const failures = buildOgaBasseyCwvConfigurationFailures({
      isDebugBearExplicitlyEnabled: true,
      shouldRunDebugBear: false,
      shouldRunPsi: true,
      targets: [{ label: 'home', url: 'https://ogabassey.com/' }],
    });

    expect(failures.map((failure) => failure.label)).toEqual([
      'debugbear',
      'debugbear-projects',
    ]);
    expect(failures.every(({ source }) => source === 'configuration')).toBe(
      true
    );
  });
});

describe('loadEnvFile', () => {
  it('loads quoted env values without overwriting existing keys', async () => {
    const env = { EXISTING: 'kept' };
    const loaded = await loadEnvFile('/tmp/.env.local', {
      env,
      readText: async () =>
        [
          '# ignored',
          'DEBUGBEAR_PROJECT_ID="101919"',
          "OGABASSEY_CWV_PSI='0'",
          'EXISTING=replaced',
        ].join('\n'),
    });

    expect(loaded).toBe(true);
    expect(env).toEqual({
      DEBUGBEAR_PROJECT_ID: '101919',
      EXISTING: 'kept',
      OGABASSEY_CWV_PSI: '0',
    });
  });

  it('can override root env-file values without replacing shell-owned keys', async () => {
    const shellOwned = new Set(['DEBUGBEAR_API_KEY']);
    const env = {
      DEBUGBEAR_API_KEY: 'shell-key',
      DEBUGBEAR_PROJECT_ID: 'root-project',
    };
    const loaded = await loadEnvFile('/apps/web/.env.local', {
      env,
      override: (key) => !shellOwned.has(key),
      readText: async () =>
        ['DEBUGBEAR_API_KEY=app-key', 'DEBUGBEAR_PROJECT_ID=app-project'].join(
          '\n'
        ),
    });

    expect(loaded).toBe(true);
    expect(env).toEqual({
      DEBUGBEAR_API_KEY: 'shell-key',
      DEBUGBEAR_PROJECT_ID: 'app-project',
    });
  });

  it('returns false when the env file is missing', async () => {
    await expect(
      loadEnvFile('/tmp/missing.env', {
        env: {},
        readText: () => {
          const error = new Error('missing');
          error.code = 'ENOENT';
          throw error;
        },
      })
    ).resolves.toBe(false);
  });
});
