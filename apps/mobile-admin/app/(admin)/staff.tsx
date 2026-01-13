/**
 * Staff Screen - Team Management
 * Invite and manage staff members with role-based permissions
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import {
  useStaff,
  useStaffStats,
  useInviteStaff,
  useUpdateStaff,
  useRemoveStaff,
  useResendInvitation,
} from '@/hooks/useStaff';
import {
  type StaffMember,
  type StaffRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  VALID_ROLES,
} from '@/lib/types/staff';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

export default function StaffScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();

  const { data: staff, isLoading, refetch } = useStaff();
  const { stats } = useStaffStats();

  const inviteStaff = useInviteStaff();
  const updateStaff = useUpdateStaff();
  const removeStaff = useRemoveStaff();
  const resendInvitation = useResendInvitation();

  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [selectedRole, setSelectedRole] = useState<StaffRole>('sales_rep');

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      const result = await inviteStaff.mutateAsync({
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: selectedRole,
      });

      setInviteModalVisible(false);
      setInviteEmail('');
      setInviteName('');
      setSelectedRole('sales_rep');

      // Offer to share the link
      if (result?.inviteUrl) {
        Alert.alert(
          'Invitation Sent',
          `We've sent an email to ${inviteEmail}. Would you like to share the link manually?`,
          [
            { text: 'Done', style: 'cancel' },
            {
              text: 'Share Link',
              onPress: () => {
                Share.share({
                  message: `You've been invited to join the team! Accept here: ${result.inviteUrl}`,
                  url: result.inviteUrl, // iOS only
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', 'Invitation sent successfully');
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send invitation'
      );
    }
  }, [inviteEmail, inviteName, selectedRole, inviteStaff]);

  const handleChangeRole = useCallback(
    async (staffId: string, newRole: StaffRole) => {
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
    },
    [updateStaff]
  );

  const handleSuspend = useCallback(
    (member: StaffMember) => {
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
    },
    [updateStaff]
  );

  const handleRemove = useCallback(
    (member: StaffMember) => {
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
    },
    [removeStaff]
  );

  const handleResendInvitation = useCallback(
    async (member: StaffMember) => {
      try {
        const result = await resendInvitation.mutateAsync(member.id);

        if (result?.inviteUrl) {
          Alert.alert(
            'Invitation Resent',
            `We've sent a new email to ${member.email}.`,
            [
              { text: 'Done', style: 'cancel' },
              {
                text: 'Share Link',
                onPress: () => {
                  Share.share({
                    message: `Here is your new invitation link: ${result.inviteUrl}`,
                    url: result.inviteUrl, // iOS only
                  });
                },
              },
            ]
          );
        } else {
          Alert.alert('Success', 'Invitation renewed');
        }
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to resend invitation'
        );
      }
    },
    [resendInvitation]
  );

  const showStaffActions = useCallback(
    (member: StaffMember) => {
      const actions: {
        text: string;
        onPress: () => void;
        style?: 'destructive' | 'cancel' | 'default';
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

      actions.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });

      Alert.alert(member.name || member.email, undefined, actions);
    },
    [handleResendInvitation, handleSuspend, handleRemove]
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return {
          bg: colors.successLight,
          text: colors.success,
          label: 'Active',
          icon: 'checkmark-circle',
        };
      case 'pending':
        return {
          bg: colors.warningLight,
          text: colors.warning,
          label: 'Pending',
          icon: 'time',
        };
      case 'suspended':
        return {
          bg: colors.errorLight,
          text: colors.error,
          label: 'Suspended',
          icon: 'close-circle',
        };
      default:
        return {
          bg: colors.border,
          text: colors.textMuted,
          label: status,
          icon: 'help-circle',
        };
    }
  };

  const renderStaffMember = ({ item }: { item: StaffMember }) => {
    const statusBadge = getStatusBadge(item.status);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.staffCard,
          { backgroundColor: colors.card },
          shadows.sm,
          pressed && { backgroundColor: colors.cardHover },
        ]}
        onPress={() => showStaffActions(item)}
      >
        <View
          style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {(item.name || item.email).charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.staffInfo}>
          <Text style={[styles.staffName, { color: colors.text }]}>
            {item.name || item.email.split('@')[0]}
          </Text>
          <Text style={[styles.staffEmail, { color: colors.textSecondary }]}>
            {item.email}
          </Text>

          <View style={styles.badgeRow}>
            <View
              style={[styles.roleBadge, { backgroundColor: colors.goldLight }]}
            >
              <Ionicons name="shield-outline" size={10} color={colors.gold} />
              <Text style={[styles.roleBadgeText, { color: colors.gold }]}>
                {ROLE_LABELS[item.role]}
              </Text>
            </View>

            <View
              style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}
            >
              <Ionicons
                name={statusBadge.icon as keyof typeof Ionicons.glyphMap}
                size={10}
                color={statusBadge.text}
              />
              <Text
                style={[styles.statusBadgeText, { color: statusBadge.text }]}
              >
                {statusBadge.label}
              </Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
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
              onPress={() => router.back()}
              style={{ marginRight: SPACING.md }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => setInviteModalVisible(true)}
              style={[styles.headerButton, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="person-add" size={18} color="#FFFFFF" />
            </Pressable>
          ),
        }}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />

        {/* Stats Summary */}
        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card },
              shadows.sm,
            ]}
          >
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {stats.total}
            </Text>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Total
            </Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card },
              shadows.sm,
            ]}
          >
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {stats.active}
            </Text>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Active
            </Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card },
              shadows.sm,
            ]}
          >
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {stats.pending}
            </Text>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Pending
            </Text>
          </View>
        </View>

        {/* Staff List */}
        <FlatList
          data={staff}
          renderItem={renderStaffMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="people-outline"
                  size={56}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No team members yet
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Invite staff to help manage your store
                </Text>
                <Pressable
                  style={[
                    styles.emptyButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setInviteModalVisible(true)}
                >
                  <Ionicons name="person-add" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Invite Team Member</Text>
                </Pressable>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Invite Modal */}
        <Modal visible={inviteModalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Invite Team Member
                </Text>
                <Pressable onPress={() => setInviteModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                >
                  Email *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="staff@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                >
                  Name (optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textMuted}
                  value={inviteName}
                  onChangeText={setInviteName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                >
                  Role *
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.roleScroll}
                >
                  {VALID_ROLES.map((role) => (
                    <Pressable
                      key={role}
                      style={[
                        styles.roleOption,
                        {
                          borderColor:
                            selectedRole === role
                              ? colors.primary
                              : colors.border,
                        },
                        selectedRole === role && {
                          backgroundColor: colors.primary + '10',
                        },
                      ]}
                      onPress={() => setSelectedRole(role)}
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          {
                            color:
                              selectedRole === role
                                ? colors.primary
                                : colors.text,
                          },
                        ]}
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text
                  style={[styles.roleDescription, { color: colors.textMuted }]}
                >
                  {ROLE_DESCRIPTIONS[selectedRole]}
                </Text>
              </View>

              <Pressable
                style={[
                  styles.inviteButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleInvite}
                disabled={inviteStaff.isPending}
              >
                <Ionicons name="mail" size={18} color="#FFFFFF" />
                <Text style={styles.inviteButtonText}>
                  {inviteStaff.isPending ? 'Sending...' : 'Send Invitation'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Role Change Modal */}
        <Modal visible={roleModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Change Role
                </Text>
                <Pressable onPress={() => setRoleModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </Pressable>
              </View>

              <ScrollView style={styles.roleList}>
                {VALID_ROLES.map((role) => (
                  <Pressable
                    key={role}
                    style={[
                      styles.roleListItem,
                      selectedRole === role && {
                        backgroundColor: colors.primary + '10',
                      },
                    ]}
                    onPress={() => setSelectedRole(role)}
                  >
                    <View>
                      <Text
                        style={[styles.roleListLabel, { color: colors.text }]}
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                      <Text
                        style={[
                          styles.roleListDesc,
                          { color: colors.textMuted },
                        ]}
                      >
                        {ROLE_DESCRIPTIONS[role]}
                      </Text>
                    </View>
                    {selectedRole === role && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                style={[
                  styles.inviteButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() =>
                  selectedStaff &&
                  handleChangeRole(selectedStaff.id, selectedRole)
                }
                disabled={updateStaff.isPending}
              >
                <Text style={styles.inviteButtonText}>
                  {updateStaff.isPending ? 'Updating...' : 'Update Role'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
    gap: SPACING.md,
  },
  staffCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  staffInfo: { flex: 1 },
  staffName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  staffEmail: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  inputGroup: { marginBottom: SPACING.lg },
  inputLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  roleScroll: { marginBottom: SPACING.xs },
  roleOption: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
  },
  roleOptionText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  roleDescription: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.xs,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  roleList: { maxHeight: 300 },
  roleListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  roleListLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  roleListDesc: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
});
