import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InviteStaffSheet } from '@/components/staff/InviteStaffSheet';
import { StaffListSection } from '@/components/staff/StaffListSection';
import { StaffRoleSheet } from '@/components/staff/StaffRoleSheet';
import { StaffSummaryCards } from '@/components/staff/StaffSummaryCards';
import { SPACING } from '@/constants/theme';
import {
  useInviteStaff,
  useRemoveStaff,
  useResendInvitation,
  useStaff,
  useStaffStats,
  useUpdateStaff,
} from '@/hooks/useStaff';
import { useStaffScreenActions } from '@/hooks/useStaffScreenActions';
import { useTheme } from '@/hooks/useTheme';
import type { StaffMember, StaffRole } from '@/lib/types/staff';

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
  const [autoCreateAccount, setAutoCreateAccount] = useState(true);
  const { handleChangeRole, handleInvite, showStaffActions } =
    useStaffScreenActions({
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
    });

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
              style={{ marginRight: SPACING.md }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityLabel="Invite team member"
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
          colors={colors}
          shadowStyle={shadows.sm}
          stats={stats}
        />

        <StaffListSection
          colors={colors}
          isLoading={isLoading}
          onInvitePress={() => setInviteModalVisible(true)}
          onMemberPress={showStaffActions}
          onRefresh={refetch}
          shadowStyle={shadows.sm}
          staff={staff}
        />

        <InviteStaffSheet
          autoCreateAccount={autoCreateAccount}
          colors={colors}
          inviteEmail={inviteEmail}
          inviteName={inviteName}
          isPending={inviteStaff.isPending}
          onClose={() => setInviteModalVisible(false)}
          onEmailChange={setInviteEmail}
          onNameChange={setInviteName}
          onSubmit={handleInvite}
          onToggleAutoCreateAccount={() =>
            setAutoCreateAccount((current) => !current)
          }
          visible={inviteModalVisible}
        />

        <StaffRoleSheet
          colors={colors}
          isPending={updateStaff.isPending}
          onClose={() => setRoleModalVisible(false)}
          onRoleSelect={setSelectedRole}
          onSubmit={() =>
            selectedStaff && handleChangeRole(selectedStaff.id, selectedRole)
          }
          selectedRole={selectedRole}
          visible={roleModalVisible}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerButton: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
