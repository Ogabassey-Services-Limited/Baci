import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { type FieldErrors, useForm } from 'react-hook-form';
import { Text } from 'react-native';
import Colors from '@/constants/Colors';
import type { ProfileFormData } from '@/schemas/profile-edit';
import { ProfileEditView } from './ProfileEditView';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{children}</View>;
  },
}));

const mockSave = jest.fn();

function ProfileEditViewHarness({
  errors = {},
  isDirty = true,
  isSubmitting = false,
  usernameSection,
}: {
  errors?: FieldErrors<ProfileFormData>;
  isDirty?: boolean;
  isSubmitting?: boolean;
  usernameSection?: ReactNode;
}) {
  const form = useForm<ProfileFormData>({
    defaultValues: {
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '08012345678',
    },
  });

  return (
    <ProfileEditView
      colors={Colors.light}
      control={form.control}
      customerEmail="shopper@example.com"
      errors={errors}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSave={mockSave}
      toast={<Text>Toast outlet</Text>}
      usernameSection={usernameSection}
    />
  );
}

describe('ProfileEditView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders editable fields and triggers the save action', () => {
    render(<ProfileEditViewHarness />);

    expect(screen.getByLabelText('First Name')).toBeTruthy();
    expect(screen.getByText('shopper@example.com')).toBeTruthy();
    expect(screen.getByText('Toast outlet')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Save Changes' }));

    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('renders field errors and announces a disabled submitting action', () => {
    render(
      <ProfileEditViewHarness
        errors={{
          first_name: {
            message: 'First name is required',
            type: 'required',
          },
        }}
        isSubmitting
      />
    );

    expect(screen.getByText('First name is required')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Save Changes' })
    ).toHaveAccessibilityState({ disabled: true });
  });

  it('disables the save action while the form is pristine', () => {
    render(<ProfileEditViewHarness isDirty={false} isSubmitting={false} />);

    const saveAction = screen.getByRole('button', { name: 'Save Changes' });

    expect(saveAction).toHaveAccessibilityState({ disabled: true });

    fireEvent.press(saveAction);

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('renders the optional username section between the phone field and email', () => {
    render(
      <ProfileEditViewHarness
        usernameSection={<Text>Username section outlet</Text>}
      />
    );

    expect(screen.getByText('Username section outlet')).toBeTruthy();
  });

  it('renders nothing extra when no username section is provided', () => {
    render(<ProfileEditViewHarness />);

    expect(screen.queryByText('Username section outlet')).toBeNull();
  });
});
