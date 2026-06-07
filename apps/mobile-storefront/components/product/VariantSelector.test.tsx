import { fireEvent, render } from '@testing-library/react-native';
import { VariantSelector } from '@/components/product/VariantSelector';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('VariantSelector', () => {
  it('prefers image-driven colors, keeps storage chips compact, and ignores stock labels when unmanaged', () => {
    const onSelectColor = jest.fn();
    const onSelectStorage = jest.fn();
    const onSelectAttribute = jest.fn();

    const { getByText, queryByText } = render(
      <VariantSelector
        attributes={{ ram: ['8GB', '16GB'] }}
        colors={['Blue']}
        colorImages={{ Blue: ['https://cdn.example.com/blue.jpg'] }}
        storage={['128GB', '256GB', '128GB']}
        variants={[
          {
            id: 'variant-128',
            name: '128GB Blue',
            price: 500000,
            stock_quantity: 0,
            attributes: { storage: '128GB' },
          },
          {
            id: 'variant-256',
            name: '256GB Blue',
            price: 560000,
            stock_quantity: 2,
            attributes: { storage: '256GB' },
          },
        ]}
        manageStock={false}
        selectedAttributes={{}}
        selectedColor={null}
        selectedStorage={null}
        onSelectAttribute={onSelectAttribute}
        onSelectColor={onSelectColor}
        onSelectStorage={onSelectStorage}
      />
    );

    expect(queryByText('Color')).toBeNull();
    expect(getByText('128GB')).toBeTruthy();
    expect(getByText('256GB')).toBeTruthy();
    expect(getByText('RAM')).toBeTruthy();
    expect(getByText('16GB')).toBeTruthy();
    expect(queryByText('Out of stock')).toBeNull();

    fireEvent.press(getByText('128GB'));
    expect(onSelectStorage).toHaveBeenCalledWith('128GB');
    fireEvent.press(getByText('16GB'));
    expect(onSelectAttribute).toHaveBeenCalledWith('ram', '16GB');
    expect(onSelectColor).not.toHaveBeenCalled();
  });

  it('renders RAM before storage for phone memory selections', () => {
    const { getAllByText } = render(
      <VariantSelector
        attributes={{ storage: ['128GB', '256GB'], ram: ['6GB', '8GB'] }}
        storage={['128GB', '256GB']}
        variants={[
          {
            id: 'variant-6-128',
            name: '6GB 128GB',
            price: 212651.16,
            attributes: { ram: '6GB', storage: '128GB' },
          },
          {
            id: 'variant-8-256',
            name: '8GB 256GB',
            price: 230604.65,
            attributes: { ram: '8GB', storage: '256GB' },
          },
        ]}
        manageStock={false}
        selectedAttributes={{ ram: '6GB' }}
        selectedColor={null}
        selectedStorage="128GB"
        onSelectAttribute={jest.fn()}
        onSelectColor={jest.fn()}
        onSelectStorage={jest.fn()}
      />
    );

    const memoryLabels = getAllByText(/^(RAM|Storage)$/).map(
      (node) => node.props.children
    );

    expect(memoryLabels).toEqual(['RAM', 'Storage']);
  });
});
