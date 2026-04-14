/**
 * Staff Screen - Team Management
 * Invite and manage staff members with role-based permissions
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StaffInviteSheet } from '@/components/staff/StaffInviteSheet';
import { StaffListPlaceholder } from '@/components/staff/StaffListPlaceholder';
import { StaffMemberCard } from '@/components/staff/StaffMemberCard';
import { StaffRoleModal } from '@/components/staff/StaffRoleModal';
import { StaffSummaryCards } from '@/components/staff/StaffSummaryCards';
import { RADIUS, SPACING } from '@/constants/theme';
import {
  useRemoveStaff,
  useResendInvitation,
  useStaff,
  useStaffStats,
  useUpdateStaff,
} from '@/hooks/useStaff';
import { useTheme } from '@/hooks/useTheme';
import type { StaffMember, StaffRole } from '@/lib/types/staff';

function getDisplayIdentity(member: StaffMember) {
  return member.name?.trim() || member.email?.trim() || 'Unknown User';
}

export default function StaffScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const {
    data: staff,
    error: staffError,
    isError: isStaffError,
    isLoading,
    isRefetching,
    refetch,
  } = useStaff();
  const { error: statsError, isError: isStatsError, stats } = useStaffStats();
  const updateStaff = useUpdateStaff();
  const removeStaff = useRemoveStaff();
  const resendInvitation = useResendInvitation();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<StaffRole>('sales_rep');

  const loadError = isStaffError
    ? staffError
    : isStatsError
      ? statsError
      : null;
  const loadErrorMessage =
    loadError instanceof Error ? loadError.message : undefined;

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
    const displayIdentity = getDisplayIdentity(member);

    try {
      const result = await resendInvitation.mutateAsync(member.id);
      const emailDeliveryFailed = result?.emailDelivery?.status === 'failed';

      if (result?.inviteUrl) {
        Alert.alert(
          emailDeliveryFailed ? 'Invite Link Updated' : 'Invitation Resent',
          emailDeliveryFailed
            ? `We couldn't deliver the invite email to ${displayIdentity}. Share the link directly instead.`
            : `A new invite email was sent to ${displayIdentity}. Share the link directly if it doesn't arrive.`,
          [
            { text: 'Done', style: 'cancel' },
            {
              text: 'Share Link',
              onPress: () => {
                Share.share({
                  message: `Here is your new invitation link: ${result.inviteUrl}`,
                  url: result.inviteUrl,
                });
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        emailDeliveryFailed ? 'Invite Renewed' : 'Success',
        emailDeliveryFailed
          ? 'The invitation was renewed, but the email could not be delivered.'
          : 'Invitation renewed'
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
        onPress: () => {
          void handleResendInvitation(member);
        },
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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Staff',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityLabel="Open invite team member sheet"
              accessibilityRole="button"
              onPress={() => setInviteModalVisible(true)}
              style={[styles.headerButton, { backgroundColor: colors.primary }]}
            >
              <Ionicons
                name="person-add"
                size={18}
                color={colors.textOnPrimary}
              />
            </Pressable>
          ),
        }}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <StaffSummaryCards
          active={stats?.active ?? 0}
          pending={stats?.pending ?? 0}
          total={stats?.total ?? 0}
        />

        <FlashList
          data={staff}
          renderItem={({ item }) => (
            <StaffMemberCard
              member={item}
              onPress={() => showStaffActions(item)}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          ListEmptyComponent={
            <StaffListPlaceholder
              mode={isLoading ? 'loading' : loadError ? 'error' : 'empty'}
              message={loadErrorMessage}
              onInvite={() => setInviteModalVisible(true)}
              onRetry={() => {
                void refetch();
              }}
            />
          }
          showsVerticalScrollIndicator={false}
        />

        <StaffInviteSheet
          visible={inviteModalVisible}
          onClose={() => setInviteModalVisible(false)}
        />
        <StaffRoleModal
          visible={roleModalVisible}
          selectedRole={selectedRole}
          onSelectRole={setSelectedRole}
          isPending={updateStaff.isPending}
          onClose={() => setRoleModalVisible(false)}
          onSubmit={() => {
            if (selectedStaff) {
              void handleChangeRole(selectedStaff.id, selectedRole);
            }
          }}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
    gap: SPACING.md,
  },
});
