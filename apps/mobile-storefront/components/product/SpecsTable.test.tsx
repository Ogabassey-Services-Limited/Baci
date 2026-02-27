/**
 * Tests for SpecsTable component.
 *
 * Verifies:
 * - Renders key-value rows for given specifications
 * - Returns null for empty specifications
 * - Serializes object values with JSON.stringify
 */

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SpecsTable } from '@/components/product/SpecsTable';
import Colors from '@/constants/Colors';

const mockColors = Colors.light;

// ---------------------------------------------------------------------------
// Rendering specifications
// ---------------------------------------------------------------------------

describe('SpecsTable — rendering', () => {
  it('renders keys and values for given specifications', () => {
    render(
      <SpecsTable
        specifications={{
          Brand: 'Samsung',
          Storage: '256GB',
          Color: 'Black',
        }}
        colors={mockColors}
      />
    );

    expect(screen.getByText('Brand')).toBeTruthy();
    expect(screen.getByText('Samsung')).toBeTruthy();
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('256GB')).toBeTruthy();
    expect(screen.getByText('Color')).toBeTruthy();
    expect(screen.getByText('Black')).toBeTruthy();
  });

  it('renders numeric values as strings', () => {
    render(<SpecsTable specifications={{ Weight: 195 }} colors={mockColors} />);

    expect(screen.getByText('Weight')).toBeTruthy();
    expect(screen.getByText('195')).toBeTruthy();
  });

  it('renders null and undefined values as empty strings', () => {
    const { UNSAFE_getAllByType } = render(
      <SpecsTable
        specifications={{ 'Null Spec': null, 'Undefined Spec': undefined }}
        colors={mockColors}
      />
    );

    // Labels render
    expect(screen.getByText('Null Spec')).toBeTruthy();
    expect(screen.getByText('Undefined Spec')).toBeTruthy();

    // Value cells: Text components that are children of spec rows.
    // With String(null ?? '') and String(undefined ?? ''), both produce ''.
    // We verify by checking that no extra non-empty text appears beyond the keys.
    const allText = UNSAFE_getAllByType(Text).map(
      (node: { props: { children: unknown } }) => {
        const child = node.props.children;
        return typeof child === 'string' ? child : '';
      }
    );
    // Should contain the two keys and two empty strings (values)
    expect(allText.filter((t: string) => t === '')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Empty specifications
// ---------------------------------------------------------------------------

describe('SpecsTable — empty specs', () => {
  it('returns null when specifications is empty', () => {
    const { toJSON } = render(
      <SpecsTable specifications={{}} colors={mockColors} />
    );

    expect(toJSON()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Object values
// ---------------------------------------------------------------------------

describe('SpecsTable — object values', () => {
  it('serializes object values with JSON.stringify', () => {
    const objValue = { min: 4, max: 8 };

    render(
      <SpecsTable specifications={{ RAM: objValue }} colors={mockColors} />
    );

    expect(screen.getByText('RAM')).toBeTruthy();
    expect(screen.getByText(JSON.stringify(objValue))).toBeTruthy();
  });

  it('serializes array values with JSON.stringify', () => {
    const arrValue = ['Wi-Fi', 'Bluetooth', '5G'];

    render(
      <SpecsTable
        specifications={{ Connectivity: arrValue }}
        colors={mockColors}
      />
    );

    expect(screen.getByText('Connectivity')).toBeTruthy();
    expect(screen.getByText(JSON.stringify(arrValue))).toBeTruthy();
  });
});
