import { Alert, Share } from 'react-native';
import { getStaffInviteFeedback } from '@/components/staff/staff-feedback';
import type { StaffMember, StaffRole, StaffStatus } from '@/lib/types/staff';

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
          onPress: () => {
            Share.share({
              message: shareMessage,
              url: shareUrl,
            });
          },
        },
      ]);
      return;
    }

    Alert.alert(title, message);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      const result = await inviteStaff.mutateAsync({
        autoCreateAccount,
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: 'sales_rep',
      });

      setInviteModalVisible(false);
      setInviteEmail('');
      setInviteName('');
      setAutoCreateAccount(true);

      showShareableAlert(
        getStaffInviteFeedback({
          email: inviteEmail,
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
    const newStatus = member.status === 'suspended' ? 'active' : 'suspended';
    const action = newStatus === 'suspended' ? 'suspend' : 'reactivate';

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Member`,
      `Are you sure you want to ${action} ${member.name || member.email}?`,
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
              Alert.alert('Success', `Team member ${action}d`);
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
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${member.name || member.email} from your team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStaff.mutateAsync(member.id);
              Alert.alert('Success', 'Team member removed');
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
          email: member.email,
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

    Alert.alert(member.name || member.email, undefined, actions);
  };

  return {
    handleChangeRole,
    handleInvite,
    showStaffActions,
  };
}
