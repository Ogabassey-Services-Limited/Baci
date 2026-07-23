import { describe, expect, it } from 'vitest';
import { parseProductionEffectCaptureArguments } from './parse-production-effect-capture-arguments';

describe('parseProductionEffectCaptureArguments', () => {
  it('accepts create, verify, or refresh mode with an optional safe output', () => {
    expect(parseProductionEffectCaptureArguments([])).toEqual({});
    expect(parseProductionEffectCaptureArguments(['--verify-only'])).toEqual({
      verifyOnly: true,
    });
    expect(
      parseProductionEffectCaptureArguments(['--refresh-fixture'])
    ).toEqual({ refreshFixture: true });
    expect(
      parseProductionEffectCaptureArguments([
        '--semantic-fixture-output',
        'fixtures/semantic.json',
      ])
    ).toEqual({ semanticFixtureOutput: 'fixtures/semantic.json' });
  });

  it.each([
    ['--unknown'],
    ['--verify-only', '--refresh-fixture'],
    ['--semantic-fixture-output'],
    ['--semantic-fixture-output', '--verify-only'],
    ['--semantic-fixture-output', '--refresh-fixture'],
    ['--semantic-fixture-output', '../escape.json'],
    ['--semantic-fixture-output', '/tmp/escape.json'],
    ['--semantic-fixture-output', 'C:\\temp\\escape.json'],
  ])('rejects invalid or ambiguous arguments: %s', (...argv) => {
    expect(() => parseProductionEffectCaptureArguments(argv)).toThrow(
      'Invalid production-effect capture arguments'
    );
  });
});
