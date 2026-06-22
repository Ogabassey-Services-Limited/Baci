import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { ConditionSelector } from './ConditionSelector';

describe('ConditionSelector single-option rendering', () => {
  it('renders nothing when only one condition is available', () => {
    render(
      <ConditionSelector
        availableConditions={['used']}
        basePrice={550_000}
        currentCondition="Used"
        offers={[]}
        onSelect={jest.fn()}
        selectedCondition="used"
      />
    );

    expect(screen.queryByRole('radiogroup', { name: 'Condition' })).toBeNull();
    expect(screen.queryByText('Used')).toBeNull();
  });
});
