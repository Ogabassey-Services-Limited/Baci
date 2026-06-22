import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function scriptEnv(outputDir) {
  return {
    ...process.env,
    DEBUGBEAR_ADMIN_API_KEY: '',
    DEBUGBEAR_API_KEY: '',
    DEBUGBEAR_PROJECT_ID: '',
    OGABASSEY_AUDIT_OUTPUT_DIR: outputDir,
    OGABASSEY_CWV_DEBUGBEAR: '0',
    OGABASSEY_CWV_PSI: '0',
    OGABASSEY_CWV_SKIP_LATEST_BLOG_POST: '1',
    PAGESPEED_INSIGHTS_API_KEY: '',
    PSI_API_KEY: '',
  };
}

describe('measure-ogabassey-cwv CLI', () => {
  it('fails closed with a stable summary when no provider is scheduled', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'ogabassey-cwv-test-'));
    const scriptPath = join(
      process.cwd(),
      'tools/perf/measure-ogabassey-cwv.mjs'
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: scriptEnv(outputDir),
    });

    expect(result.status).toBe(1);
    const files = await readdir(outputDir);
    expect(files).toContain('summary.json');
    expect(files.some((file) => file.endsWith('-summary.json'))).toBe(false);

    const summary = JSON.parse(
      await readFile(join(outputDir, 'summary.json'), 'utf8')
    );
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'measurement',
          message: expect.stringContaining('No CWV provider is scheduled'),
          source: 'configuration',
        }),
      ])
    );
    expect(summary.targets.map((target) => target.label)).toEqual([
      'home',
      'pdp-dell',
      'blog-index',
    ]);
  });
});
