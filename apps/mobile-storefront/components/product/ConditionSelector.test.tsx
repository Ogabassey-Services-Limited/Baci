import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ConditionSelector } from './ConditionSelector';

const noop = jest.fn();

describe('ConditionSelector', () => {
  it('renders the real New option only when it is explicitly available', () => {
    render(
      <ConditionSelector
        availableConditions={['new', 'used']}
        currentCondition="New"
        offers={[
          {
            id: 'offer-used',
            condition: 'used',
            price: 480000,
            stock_quantity: 2,
          },
        ]}
        selectedCondition={null}
        onSelect={noop}
        basePrice={550000}
      />
    );

    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('₦550,000')).toBeTruthy();
    expect(screen.getByText('₦480,000')).toBeTruthy();
  });

  it('does not inject a fake New option from the "Multiple Conditions" display label', () => {
    render(
      <ConditionSelector
        availableConditions={['used', 'open_box']}
        currentCondition="Multiple Conditions"
        offers={[
          {
            id: 'offer-used',
            condition: 'used',
            price: 480000,
            stock_quantity: 2,
          },
          {
            id: 'offer-open-box',
            condition: 'open_box',
            price: 520000,
            stock_quantity: 1,
          },
        ]}
        selectedCondition={null}
        onSelect={noop}
        basePrice={550000}
      />
    );

    expect(screen.queryByText('New')).toBeNull();
    expect(screen.getByText('Used')).toBeTruthy();
    expect(screen.getByText('Open Box')).toBeTruthy();
    expect(screen.getByText('₦480,000')).toBeTruthy();
    expect(screen.getByText('₦520,000')).toBeTruthy();
  });

  it('renders cheaper storefront conditions left to right as used, open box, then new', () => {
    render(
      <ConditionSelector
        availableConditions={['new', 'open_box', 'used']}
        currentCondition="Multiple Conditions"
        offers={[
          {
            id: 'offer-new',
            condition: 'new',
            price: 620000,
            stock_quantity: 1,
          },
          {
            id: 'offer-open-box',
            condition: 'open_box',
            price: 560000,
            stock_quantity: 1,
          },
          {
            id: 'offer-used',
            condition: 'used',
            price: 470000,
            stock_quantity: 1,
          },
        ]}
        selectedCondition={null}
        onSelect={noop}
        basePrice={620000}
      />
    );

    expect(
      screen.getAllByRole('radio').map((item) => item.props.accessibilityLabel)
    ).toEqual(['Used, ₦470,000', 'Open Box, ₦560,000', 'New, ₦620,000']);
    expect(screen.getByRole('radiogroup', { name: 'Condition' })).toBeTruthy();
  });

  it('deduplicates repeated canonical conditions from the base product, offers, and available list', () => {
    render(
      <ConditionSelector
        availableConditions={['used', 'open_box', 'used']}
        currentCondition="Used"
        offers={[
          {
            id: 'offer-used-1',
            condition: 'used',
            price: 470000,
            stock_quantity: 1,
          },
          {
            id: 'offer-used-2',
            condition: 'used',
            price: 470000,
            stock_quantity: 1,
          },
          {
            id: 'offer-open-box',
            condition: 'open_box',
            price: 560000,
            stock_quantity: 1,
          },
        ]}
        selectedCondition="used"
        onSelect={noop}
        basePrice={560000}
      />
    );

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(
      screen.getAllByRole('radio').map((item) => item.props.accessibilityLabel)
    ).toEqual(['Used, ₦470,000', 'Open Box, ₦560,000']);
  });

  it('calls onSelect with the tapped canonical condition', () => {
    const onSelect = jest.fn();

    render(
      <ConditionSelector
        availableConditions={['used', 'open_box']}
        currentCondition="Used"
        offers={[
          {
            id: 'offer-used',
            condition: 'used',
            price: 480000,
            stock_quantity: 2,
          },
          {
            id: 'offer-open-box',
            condition: 'open_box',
            price: 520000,
            stock_quantity: 1,
          },
        ]}
        selectedCondition={null}
        onSelect={onSelect}
        basePrice={550000}
      />
    );

    fireEvent.press(screen.getByText('Used'));
    fireEvent.press(screen.getByText('Open Box'));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'used');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'open_box');
  });

  it('marks the selected condition as checked', () => {
    render(
      <ConditionSelector
        availableConditions={['used', 'open_box']}
        currentCondition="Used"
        offers={[
          {
            id: 'offer-used',
            condition: 'used',
            price: 480000,
            stock_quantity: 2,
          },
          {
            id: 'offer-open-box',
            condition: 'open_box',
            price: 520000,
            stock_quantity: 1,
          },
        ]}
        selectedCondition="open_box"
        onSelect={noop}
        basePrice={550000}
      />
    );

    expect(screen.getByLabelText(/Open Box/).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true })
    );
    expect(screen.getByLabelText(/Used/).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false })
    );
  });

  it('renders each chip with its own per-condition price from offers', () => {
    render(
      <ConditionSelector
        availableConditions={['used', 'open_box']}
        currentCondition="open_box"
        offers={[
          {
            id: 'variant-condition-open_box',
            condition: 'open_box',
            price: 520000,
            stock_quantity: 0,
          },
          {
            id: 'variant-condition-used',
            condition: 'used',
            price: 470000,
            stock_quantity: 0,
          },
        ]}
        selectedCondition="open_box"
        onSelect={noop}
        basePrice={520000}
      />
    );

    // Open Box uses its own offer price (matches basePrice); Used uses cheaper offer price.
    expect(screen.getByText('₦520,000')).toBeTruthy();
    expect(screen.getByText('₦470,000')).toBeTruthy();
  });

  it('hides per-condition prices when the caller disables condition pricing', () => {
    render(
      <ConditionSelector
        availableConditions={['used', 'open_box']}
        currentCondition="Multiple Conditions"
        offers={[
          {
            id: 'variant-condition-open_box',
            condition: 'open_box',
            price: 520000,
            stock_quantity: 0,
          },
          {
            id: 'variant-condition-used',
            condition: 'used',
            price: 470000,
            stock_quantity: 0,
          },
        ]}
        selectedCondition="open_box"
        onSelect={noop}
        basePrice={520000}
        showPrices={false}
      />
    );

    expect(screen.queryByText('₦520,000')).toBeNull();
    expect(screen.queryByText('₦470,000')).toBeNull();
    expect(screen.getByLabelText('Open Box')).toBeTruthy();
    expect(screen.getByLabelText('Used')).toBeTruthy();
  });

  it('normalizes aliased selected conditions before computing the checked option', () => {
    render(
      <ConditionSelector
        availableConditions={['used', 'open_box']}
        currentCondition="Used"
        offers={[
          {
            id: 'offer-used',
            condition: 'used',
            price: 480000,
            stock_quantity: 2,
          },
          {
            id: 'offer-open-box',
            condition: 'open_box',
            price: 520000,
            stock_quantity: 1,
          },
        ]}
        selectedCondition="refurbished"
        onSelect={noop}
        basePrice={550000}
      />
    );

    expect(screen.getByLabelText(/Open Box/).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true })
    );
  });
});
