import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POSTHOG_ASSETS_HOST,
  DEFAULT_POSTHOG_INGEST_HOST,
  DEFAULT_POSTHOG_PROXY_PATH,
  DEFAULT_POSTHOG_UI_HOST,
  getPostHogAssetsHost,
  getPostHogIngestHost,
  getPostHogProxyPath,
  getPostHogReleaseVersion,
  getPostHogUiHost,
  isPostHogSourceMapUploadEnabled,
  normalizePostHogHost,
  normalizePostHogProxyPath,
} from './config';

describe('PostHog config helpers', () => {
  it('normalizes proxy paths for Next rewrites', () => {
    expect(normalizePostHogProxyPath()).toBe(DEFAULT_POSTHOG_PROXY_PATH);
    expect(normalizePostHogProxyPath('baci-observe/')).toBe('/baci-observe');
    expect(normalizePostHogProxyPath('/baci-observe///')).toBe('/baci-observe');
  });

  it('uses EU hosts by default', () => {
    expect(getPostHogIngestHost({})).toBe(DEFAULT_POSTHOG_INGEST_HOST);
    expect(getPostHogAssetsHost({})).toBe(DEFAULT_POSTHOG_ASSETS_HOST);
    expect(getPostHogUiHost({})).toBe(DEFAULT_POSTHOG_UI_HOST);
    expect(getPostHogProxyPath({})).toBe(DEFAULT_POSTHOG_PROXY_PATH);
  });

  it('allows host and proxy overrides', () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_HOST: ' https://custom-ingest.example.com/ ',
      NEXT_PUBLIC_POSTHOG_ASSETS_HOST: ' https://custom-assets.example.com// ',
      NEXT_PUBLIC_POSTHOG_UI_HOST: ' https://custom-ui.example.com/ ',
      NEXT_PUBLIC_POSTHOG_PROXY_PATH: ' baci-observe ',
    };

    expect(getPostHogIngestHost(env)).toBe('https://custom-ingest.example.com');
    expect(getPostHogAssetsHost(env)).toBe('https://custom-assets.example.com');
    expect(getPostHogUiHost(env)).toBe('https://custom-ui.example.com');
    expect(getPostHogProxyPath(env)).toBe('/baci-observe');
  });

  it('normalizes host overrides without changing empty fallback behavior', () => {
    expect(normalizePostHogHost(' https://posthog.example.com/// ')).toBe(
      'https://posthog.example.com'
    );
    expect(normalizePostHogHost('   ')).toBe('');
    expect(normalizePostHogHost(undefined)).toBe('');
  });

  it('enables source-map uploads only when secret and project id exist', () => {
    expect(isPostHogSourceMapUploadEnabled({})).toBe(false);
    expect(
      isPostHogSourceMapUploadEnabled({
        POSTHOG_API_KEY: 'phx_secret',
        POSTHOG_PROJECT_ID: '202711',
      })
    ).toBe(true);
  });

  it('uses the most specific release version available', () => {
    expect(
      getPostHogReleaseVersion({
        POSTHOG_RELEASE_VERSION: 'release-1',
        VERCEL_GIT_COMMIT_SHA: 'vercel-sha',
      })
    ).toBe('release-1');
    expect(
      getPostHogReleaseVersion({
        VERCEL_GIT_COMMIT_SHA: 'vercel-sha',
        GITHUB_SHA: 'github-sha',
      })
    ).toBe('vercel-sha');
  });
});
