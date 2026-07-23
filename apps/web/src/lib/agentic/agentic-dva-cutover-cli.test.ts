import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { agenticDvaCutoverCli } from './agentic-dva-cutover-cli';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

function validArgs(): string[] {
  return [
    '--session-id',
    'agentic_session_1',
    '--expected-state',
    'claiming_payment',
    '--evidence-fingerprint',
    'a'.repeat(64),
  ];
}

describe('agenticDvaCutoverCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses an exact dry-run request', () => {
    const fingerprint = 'a'.repeat(64);

    const result = agenticDvaCutoverCli.parseArgs(validArgs());

    expect(result).toEqual({
      apply: false,
      expectedState: 'claiming_payment',
      fingerprint,
      sessionId: 'agentic_session_1',
    });
  });

  it('parses the explicit apply toggle', () => {
    const result = agenticDvaCutoverCli.parseArgs([...validArgs(), '--apply']);

    expect(result.apply).toBe(true);
  });

  it.each([
    ['unknown flag', ['--unknown', 'value']],
    ['duplicate flag', [...validArgs(), '--session-id', 'agentic_other']],
    ['duplicate apply flag', [...validArgs(), '--apply', '--apply']],
    ['missing session', validArgs().slice(2)],
    [
      'invalid session',
      validArgs().map((value, index) => (index === 1 ? 'session-1' : value)),
    ],
    [
      'invalid state',
      validArgs().map((value, index) => (index === 3 ? 'paid' : value)),
    ],
    [
      'short fingerprint',
      validArgs().map((value, index) => (index === 5 ? 'abc' : value)),
    ],
    [
      'uppercase fingerprint',
      validArgs().map((value, index) => (index === 5 ? 'A'.repeat(64) : value)),
    ],
  ])('rejects %s', (_case, argv) => {
    expect(() => agenticDvaCutoverCli.parseArgs(argv)).toThrow();
  });

  it('compares only exact lowercase fingerprints', () => {
    const fingerprint = 'a'.repeat(64);

    const matches = agenticDvaCutoverCli.fingerprintsMatch(
      fingerprint,
      fingerprint
    );
    const differs = agenticDvaCutoverCli.fingerprintsMatch(
      fingerprint,
      'b'.repeat(64)
    );

    expect(matches).toBe(true);
    expect(differs).toBe(false);
  });

  it.each([
    ['', ''],
    ['abc', 'abc'],
    ['A'.repeat(64), 'A'.repeat(64)],
    [`${'a'.repeat(63)}z`, `${'a'.repeat(63)}z`],
  ])('rejects matching malformed fingerprints %#', (actual, expected) => {
    expect(agenticDvaCutoverCli.fingerprintsMatch(actual, expected)).toBe(
      false
    );
  });

  it('fails closed and logs an invalid mode configuration', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'invalid');

    const paused = agenticDvaCutoverCli.isPaused();

    expect(paused).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AGENTIC_DVA_CUTOVER_MODE_RESOLUTION_FAILED',
      })
    );
  });

  it('recognizes the explicitly paused mode', () => {
    expect(agenticDvaCutoverCli.isPaused()).toBe(true);
  });
});
