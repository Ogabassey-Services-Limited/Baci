import {
  areLocationStateLabelsEquivalent,
  resolveLocationStateLabel,
} from './location-state-aliases';

describe('location-state-aliases', () => {
  it('resolves FCT aliases to the available API state label', () => {
    expect(
      resolveLocationStateLabel('Federal Capital Territory', [
        'Abia',
        'Abuja',
        'Lagos',
      ])
    ).toBe('Abuja');
    expect(resolveLocationStateLabel('FCT', ['FCT - Abuja', 'Lagos'])).toBe(
      'FCT - Abuja'
    );
  });

  it('preserves regular state names and state suffix normalization', () => {
    expect(resolveLocationStateLabel('Lagos State', ['Lagos', 'Ogun'])).toBe(
      'Lagos'
    );
    expect(resolveLocationStateLabel('Anambra', ['Lagos', 'Ogun'])).toBe(
      'Anambra'
    );
  });

  it('compares equivalent FCT labels', () => {
    expect(
      areLocationStateLabelsEquivalent(
        'FCT - Abuja',
        'Federal Capital Territory'
      )
    ).toBe(true);
    expect(areLocationStateLabelsEquivalent('Abuja', 'FCT')).toBe(true);
    expect(areLocationStateLabelsEquivalent('Lagos', 'FCT')).toBe(false);
  });
});
