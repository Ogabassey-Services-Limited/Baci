import { jest } from '@jest/globals';
import { render, screen, userEvent } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';
import { RecentUtilityRecipients } from './RecentUtilityRecipients';

const colors = Colors.light;

const recipients: UtilityRepeatRecipient[] = [
  {
    id: 'one',
    title: 'OLUROTIMI OLADIMEJI ADEBANJO',
    identifierLabel: 'Meter Number',
    identifier: '43901766923',
    meta: '₦2,500',
    defaults: {
      amount: '2500',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'KUD-ELE-EKED-002',
      customerIdentifier: '43901766923',
      customerName: 'OLUROTIMI OLADIMEJI ADEBANJO',
      isVerified: true,
    },
  },
  {
    id: 'two',
    title: 'OLADIMEJI OLUROTIMI ADEBANJO',
    identifierLabel: 'Meter Number',
    identifier: '43901577981',
    meta: '₦1,000',
    defaults: {
      amount: '1000',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'KUD-ELE-EKED-002',
      customerIdentifier: '43901577981',
      customerName: 'OLADIMEJI OLUROTIMI ADEBANJO',
      isVerified: true,
    },
  },
  {
    id: 'three',
    title: 'Backup meter',
    identifierLabel: 'Meter Number',
    identifier: '43901999999',
    meta: '₦500',
    defaults: {
      amount: '500',
      customerIdentifier: '43901999999',
      isVerified: true,
    },
  },
];

describe('RecentUtilityRecipients', () => {
  it('renders nothing when there are no recipients', () => {
    const { toJSON } = render(
      <RecentUtilityRecipients
        colors={colors}
        recipients={[]}
        onSelect={jest.fn()}
      />
    );

    expect(toJSON()).toBeNull();
  });

  it('shows the first two recipients and a see all button', () => {
    render(
      <RecentUtilityRecipients
        colors={colors}
        recipients={recipients}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Select Beneficiary')).toBeOnTheScreen();
    expect(screen.getByText('OLUROTIMI OLADIMEJI ADEBANJO')).toBeOnTheScreen();
    expect(screen.getByText('OLADIMEJI OLUROTIMI ADEBANJO')).toBeOnTheScreen();
    expect(screen.queryByText('Backup meter')).toBeNull();
    expect(screen.getByText('See all')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('See all beneficiaries')
    ).toHaveAccessibilityState({
      expanded: false,
    });
  });

  it('expands to show all recipients', async () => {
    const user = userEvent.setup();

    render(
      <RecentUtilityRecipients
        colors={colors}
        recipients={recipients}
        onSelect={jest.fn()}
      />
    );

    await user.press(screen.getByText('See all'));

    expect(screen.getByText('Backup meter')).toBeOnTheScreen();
    expect(screen.getByText('Show less')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Show fewer beneficiaries')
    ).toHaveAccessibilityState({
      expanded: true,
    });
  });

  it('calls onSelect with the pressed recipient', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();

    render(
      <RecentUtilityRecipients
        colors={colors}
        recipients={recipients}
        onSelect={onSelect}
      />
    );

    await user.press(
      screen.getByLabelText(
        'Select OLUROTIMI OLADIMEJI ADEBANJO, Meter Number 43901766923'
      )
    );

    expect(onSelect).toHaveBeenCalledWith(recipients[0]);
  });
});
