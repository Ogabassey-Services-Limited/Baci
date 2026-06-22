import { describe, expect, it } from 'vitest';
import {
  buildDebugBearHeaders,
  buildOgaBasseyCwvTargets,
  findDebugBearProjectIdForUrl,
  normalizeDebugBearProjects,
} from './measure-ogabassey-cwv-utils.mjs';

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
});
