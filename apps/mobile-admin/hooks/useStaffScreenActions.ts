import { Alert, Share } from 'react-native';
import { getStaffInviteFeedback } from '@/components/staff/staff-feedback';
import type { StaffMember, StaffRole, StaffStatus } from '@/lib/types/staff';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteResult {
  emailDelivery?: {
    status?: 'failed' | 'sent';
  };
  inviteUrl?: string;
}

interface AsyncMutation<TInput, TResult = unknown> {
  mutateAsync: (input: TInput) => Promise<TResult>;
}

interface UseStaffScreenActionsProps {
  autoCreateAccount: boolean;
  inviteEmail: string;
  inviteName: string;
  inviteStaff: AsyncMutation<
    {
      autoCreateAccount: boolean;
      email: string;
      name?: string;
      role: StaffRole;
    },
    InviteResult
  >;
  removeStaff: AsyncMutation<string>;
  resendInvitation: AsyncMutation<string, InviteResult>;
  setAutoCreateAccount: (value: boolean) => void;
  setInviteEmail: (value: string) => void;
  setInviteModalVisible: (value: boolean) => void;
  setInviteName: (value: string) => void;
  setRoleModalVisible: (value: boolean) => void;
  setSelectedRole: (value: StaffRole) => void;
  setSelectedStaff: (member: StaffMember | null) => void;
  updateStaff: AsyncMutation<{
    id: string;
    role?: StaffRole;
    status?: StaffStatus;
  }>;
}

export function useStaffScreenActions({
  autoCreateAccount,
  inviteEmail,
  inviteName,
  inviteStaff,
  removeStaff,
  resendInvitation,
  setAutoCreateAccount,
  setInviteEmail,
  setInviteModalVisible,
  setInviteName,
  setRoleModalVisible,
  setSelectedRole,
  setSelectedStaff,
  updateStaff,
}: UseStaffScreenActionsProps) {
  const getDisplayIdentity = ({
    email,
    name,
  }: Pick<StaffMember, 'email' | 'name'>) =>
    name?.trim() || email?.trim() || 'Unknown User';

  const showShareableAlert = ({
    message,
    shareMessage,
    shareUrl,
    title,
  }: {
    message: string;
    shareMessage?: string;
    shareUrl?: string;
    title: string;
  }) => {
    if (shareMessage && shareUrl) {
      Alert.alert(title, message, [
        { text: 'Done', style: 'cancel' },
        {
          text: 'Share Link',
          onPress: async () => {
            try {
              await Share.share({
                message: shareMessage,
                url: shareUrl,
              });
            } catch (error) {
              console.error('Failed to open share sheet:', error);
              Alert.alert(
                'Unable to Share',
                'Could not open the share sheet. Please try again.'
              );
            }
          },
        },
      ]);
      return;
    }

    Alert.alert(title, message);
  };

  const handleInvite = async () => {
    const normalizedEmail = inviteEmail.trim();

    if (!normalizedEmail) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      const result = await inviteStaff.mutateAsync({
        autoCreateAccount,
        email: normalizedEmail,
        name: inviteName.trim() || undefined,
        role: 'sales_rep',
      });

      setInviteModalVisible(false);
      setInviteEmail('');
      setInviteName('');
      setAutoCreateAccount(true);

      showShareableAlert(
        getStaffInviteFeedback({
          email: normalizedEmail,
          emailDeliveryFailed: result?.emailDelivery?.status === 'failed',
          inviteUrl: result?.inviteUrl,
          kind: 'invite',
        })
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send invitation'
      );
    }
  };

  const handleChangeRole = async (staffId: string, newRole: StaffRole) => {
    try {
      await updateStaff.mutateAsync({ id: staffId, role: newRole });
      Alert.alert('Success', 'Role updated successfully');
      setRoleModalVisible(false);
      setSelectedStaff(null);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update role'
      );
    }
  };

  const handleSuspend = (member: StaffMember) => {
    const displayIdentity = getDisplayIdentity(member);
    const newStatus = member.status === 'suspended' ? 'active' : 'suspended';
    const action = newStatus === 'suspended' ? 'suspend' : 'reactivate';
    const successMessage =
      newStatus === 'suspended'
        ? `${displayIdentity} suspended`
        : `${displayIdentity} reactivated`;

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Member`,
      `Are you sure you want to ${action} ${displayIdentity}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: newStatus === 'suspended' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateStaff.mutateAsync({
                id: member.id,
                status: newStatus,
              });
              Alert.alert('Success', successMessage);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to update status'
              );
            }
          },
        },
      ]
    );
  };

  const handleRemove = (member: StaffMember) => {
    const displayIdentity = getDisplayIdentity(member);

    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${displayIdentity} from your team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStaff.mutateAsync(member.id);
              Alert.alert('Success', `${displayIdentity} removed`);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to remove member'
              );
            }
          },
        },
      ]
    );
  };

  const handleResendInvitation = async (member: StaffMember) => {
    try {
      const result = await resendInvitation.mutateAsync(member.id);
      showShareableAlert(
        getStaffInviteFeedback({
          email: member.email ?? '',
          emailDeliveryFailed: result?.emailDelivery?.status === 'failed',
          inviteUrl: result?.inviteUrl,
          kind: 'resend',
        })
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to resend invitation'
      );
    }
  };

  const showStaffActions = (member: StaffMember) => {
    const displayIdentity = getDisplayIdentity(member);
    const actions: {
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'default' | 'destructive';
    }[] = [];

    if (member.status === 'pending') {
      actions.push({
        text: 'Resend Invitation',
        onPress: () => handleResendInvitation(member),
      });
    }

    actions.push({
      text: 'Change Role',
      onPress: () => {
        setSelectedStaff(member);
        setSelectedRole(member.role);
        setRoleModalVisible(true);
      },
    });

    if (member.status === 'active') {
      actions.push({
        text: 'Suspend Access',
        onPress: () => handleSuspend(member),
        style: 'destructive',
      });
    } else if (member.status === 'suspended') {
      actions.push({
        text: 'Reactivate',
        onPress: () => handleSuspend(member),
      });
    }

    actions.push({
      text: 'Remove',
      onPress: () => handleRemove(member),
      style: 'destructive',
    });
    actions.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(displayIdentity, undefined, actions);
  };

  return {
    handleChangeRole,
    handleInvite,
    showStaffActions,
  };
}
