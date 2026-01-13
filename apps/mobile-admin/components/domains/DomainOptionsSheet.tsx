import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface Domain {
  id: string;
  domain: string;
  is_primary: boolean;
  status: 'active' | 'pending' | 'failed' | 'verifying';
  domain_type: 'subdomain' | 'custom' | 'purchased';
  created_at: string;
}

interface DomainOptionsSheetProps {
  visible: boolean;
  domain: Domain | null;
  onClose: () => void;
  onAction: (
    action: 'visit' | 'verify' | 'set_primary' | 'delete',
    domain: Domain
  ) => void;
}

export default function DomainOptionsSheet({
  visible,
  domain,
  onClose,
  onAction,
}: DomainOptionsSheetProps) {
  const { colors, shadows } = useTheme();

  if (!domain) return null;

  const handleAction = (
    action: 'visit' | 'verify' | 'set_primary' | 'delete'
  ) => {
    onClose();
    // Small delay to allow sheet to close before action (smoothness)
    setTimeout(() => {
      onAction(action, domain);
    }, 100);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none" // We handle animation with Reanimated
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
        />
      </Pressable>

      <View style={styles.sheetContainer} pointerEvents="box-none">
        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: SPACING.xl * 2 }, // Extra padding for safe area
            shadows.lg,
          ]}
        >
          {/* Handle Indicator */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor:
                    domain.status === 'active'
                      ? colors.successLight
                      : colors.warningLight,
                },
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={24}
                color={
                  domain.status === 'active' ? colors.success : colors.warning
                }
              />
            </View>
            <View>
              <Text style={[styles.domainName, { color: colors.text }]}>
                {domain.domain}
              </Text>
              <Text
                style={[styles.domainType, { color: colors.textSecondary }]}
              >
                {domain.domain_type === 'subdomain'
                  ? 'Store Link'
                  : 'Custom Domain'}{' '}
                • {domain.status}
              </Text>
            </View>
          </View>

          {/* Actions List */}
          <View style={styles.actionsList}>
            {/* Visit Site */}
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: pressed ? colors.background : 'transparent',
                },
              ]}
              onPress={() => handleAction('visit')}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.background },
                ]}
              >
                <Ionicons name="open-outline" size={20} color={colors.text} />
              </View>
              <Text style={[styles.actionText, { color: colors.text }]}>
                Visit Site
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textMuted}
              />
            </Pressable>

            {/* Verify DNS (Conditional) */}
            {domain.domain_type === 'custom' && domain.status !== 'active' && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: pressed
                      ? colors.background
                      : 'transparent',
                  },
                ]}
                onPress={() => handleAction('verify')}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: colors.warningLight },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={colors.warning}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionText, { color: colors.text }]}>
                    Verify DNS Connection
                  </Text>
                  <Text
                    style={[
                      styles.actionSubtext,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Required to take site live
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
            )}

            {/* Set as Primary (Conditional) */}
            {!domain.is_primary && domain.status === 'active' && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: pressed
                      ? colors.background
                      : 'transparent',
                  },
                ]}
                onPress={() => handleAction('set_primary')}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Ionicons
                    name="star-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionText, { color: colors.text }]}>
                    Set as Primary Domain
                  </Text>
                  <Text
                    style={[
                      styles.actionSubtext,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Make this your main store link
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
            )}

            {/* Separator if Delete is present */}
            {!domain.is_primary && (
              <View
                style={[styles.separator, { backgroundColor: colors.border }]}
              />
            )}

            {/* Delete (Destructive) */}
            {!domain.is_primary && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: pressed
                      ? colors.errorLight
                      : 'transparent',
                  },
                ]}
                onPress={() => handleAction('delete')}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: colors.errorLight },
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.error}
                  />
                </View>
                <Text style={[styles.actionText, { color: colors.error }]}>
                  Delete Domain
                </Text>
              </Pressable>
            )}
          </View>

          {/* Cancel Button */}
          <View style={styles.footer}>
            <Pressable
              style={[
                styles.cancelButton,
                { backgroundColor: colors.background },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
    marginBottom: 2,
  },
  domainType: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  actionsList: {
    paddingVertical: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
    flex: 1,
  },
  actionSubtext: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginVertical: SPACING.sm,
    marginHorizontal: SPACING.xl,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  cancelButton: {
    height: 50,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
