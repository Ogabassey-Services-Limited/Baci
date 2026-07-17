import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  parse: vi.fn(),
  root: vi.fn(),
}));

vi.mock('./capture-production-effect-provenance', () => ({
  captureProductionEffectProvenance: mocks.capture,
}));
vi.mock('./parse-production-effect-capture-arguments', () => ({
  parseProductionEffectCaptureArguments: mocks.parse,
}));
vi.mock('./replay-repository-root', () => ({
  replayRepository: { root: mocks.root },
}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

async function importCli() {
  vi.resetModules();
  await import('./capture-production-effect-provenance-cli');
}

beforeEach(() => {
  process.argv = ['node', 'capture-production-effect-provenance-cli.ts'];
  process.exitCode = undefined;
  mocks.capture.mockReset().mockResolvedValue({
    fixtureSha256: '0'.repeat(64),
    sourceCount: 0,
  });
  mocks.parse.mockReset().mockReturnValue({ verifyOnly: true });
  mocks.root.mockReset().mockReturnValue('/workspace');
});

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe('capture-production-effect-provenance-cli', () => {
  it('dispatches parsed arguments with the default fixture path', async () => {
    await importCli();

    expect(mocks.parse).toHaveBeenCalledWith([]);
    expect(mocks.root).toHaveBeenCalledOnce();
    expect(mocks.capture).toHaveBeenCalledWith({
      semanticFixtureOutput:
        'apps/web/tools/db/fixtures/github-migration-semantic-lines.json',
      verifyOnly: true,
      workspaceRoot: '/workspace',
    });
  });

  it('emits only a sanitized diagnostic when capture rejects', async () => {
    const rawFailure = 'offline capture failure with sensitive raw log text';
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.capture.mockRejectedValueOnce(new Error(rawFailure));

    await importCli();

    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(diagnostic).toHaveBeenCalledOnce();
    expect(diagnostic).toHaveBeenCalledWith(
      'Production-effect provenance capture failed'
    );
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(rawFailure);
  });

  it('sanitizes argument-parser failures without leaking stack paths', async () => {
    const rawFailure =
      'Missing value for --semantic-fixture-output\n    at parse (/Users/mac/Baci-app/private/tool.ts:42:7)';
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.parse.mockImplementationOnce(() => {
      throw new Error(rawFailure);
    });

    await importCli();

    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(diagnostic).toHaveBeenCalledOnce();
    expect(diagnostic).toHaveBeenCalledWith(
      'Production-effect provenance capture failed'
    );
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(rawFailure);
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(
      '/Users/mac/Baci-app/private/tool.ts'
    );
  });
});
