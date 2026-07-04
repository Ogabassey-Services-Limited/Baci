import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import Colors from '@/constants/Colors';
import { CollapsibleCheckoutCard } from './CollapsibleCheckoutCard';

const colors = Colors.dark;

function renderCard(overrides: {
  collapsed?: boolean;
  canCollapse?: boolean;
  onToggle?: () => void;
} = {}) {
  render(
    <CollapsibleCheckoutCard
      icon="person-outline"
      title="Contact"
      colors={colors}
      isDark
      collapsed={overrides.collapsed ?? false}
      canCollapse={overrides.canCollapse ?? true}
      onToggle={overrides.onToggle ?? (() => {})}
      summary={<Text>SUMMARY</Text>}
    >
      <Text>FORM_BODY</Text>
    </CollapsibleCheckoutCard>
  );
}

describe('CollapsibleCheckoutCard', () => {
  it('renders the form body when expanded and the summary when collapsed', () => {
    const { rerender } = render(
      <CollapsibleCheckoutCard
        icon="person-outline"
        title="Contact"
        colors={colors}
        isDark
        collapsed={false}
        canCollapse
        onToggle={() => {}}
        summary={<Text>SUMMARY</Text>}
      >
        <Text>FORM_BODY</Text>
      </CollapsibleCheckoutCard>
    );
    expect(screen.getByText('FORM_BODY')).toBeTruthy();
    expect(screen.queryByText('SUMMARY')).toBeNull();

    rerender(
      <CollapsibleCheckoutCard
        icon="person-outline"
        title="Contact"
        colors={colors}
        isDark
        collapsed
        canCollapse
        onToggle={() => {}}
        summary={<Text>SUMMARY</Text>}
      >
        <Text>FORM_BODY</Text>
      </CollapsibleCheckoutCard>
    );
    expect(screen.getByText('SUMMARY')).toBeTruthy();
    expect(screen.queryByText('FORM_BODY')).toBeNull();
  });

  it('fires onToggle from the Edit/Done control', () => {
    const onToggle = jest.fn();
    renderCard({ collapsed: true, onToggle });
    fireEvent.press(screen.getByRole('button', { name: 'Edit Contact' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('hides the Edit/Done control when the section cannot collapse', () => {
    renderCard({ canCollapse: false });
    expect(screen.queryByRole('button', { name: /Contact/ })).toBeNull();
  });

  it('falls back to the form (never a dead-end summary) when collapsed=true but canCollapse=false', () => {
    // A caller can pass collapsed=true while the section is not collapsible
    // (e.g. Delivery forced collapsed with no saved address/summary). The card
    // must show the form, not strand the user on a summary with no reopen.
    renderCard({ collapsed: true, canCollapse: false });
    expect(screen.getByText('FORM_BODY')).toBeTruthy();
    expect(screen.queryByText('SUMMARY')).toBeNull();
  });
});
