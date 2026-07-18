import { describe, expect, it } from 'vitest';
import { eventPipelineSourceFilePolicy } from './event-pipeline-source-file-policy';

describe('eventPipelineSourceFilePolicy', () => {
  it.each([
    'authority.ts',
    'authority.tsx',
    'authority.js',
    'authority.jsx',
    'authority.mjs',
    'authority.cjs',
    'authority.mts',
    'authority.cts',
  ])('includes %s in authority inventories', (path) => {
    expect(eventPipelineSourceFilePolicy.isSourcePath(path)).toBe(true);
    expect(eventPipelineSourceFilePolicy.pathspecs).toContain(
      `*.${path.split('.').at(-1)}`
    );
  });

  it.each([
    'authority.css',
    'authority.json',
    'authority.sql',
  ])('excludes non-source path %s', (path) => {
    expect(eventPipelineSourceFilePolicy.isSourcePath(path)).toBe(false);
  });
});
