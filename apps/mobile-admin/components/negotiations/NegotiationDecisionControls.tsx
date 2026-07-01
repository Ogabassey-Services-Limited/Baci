import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type {
  NegotiationCardColors,
  NegotiationStatus,
} from './NegotiationCard';
import { negotiationCardStyles as styles } from './NegotiationCard.styles';

interface NegotiationDecisionControlsProps {
  actionLoading: boolean;
  actionsDisabled: boolean;
  colors: NegotiationCardColors;
  itemId: string;
  onAction: (id: string, status: 'accepted' | 'rejected') => void;
  status: NegotiationStatus;
}

function formatNegotiationStatus(status: NegotiationStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function NegotiationDecisionControls({
  actionLoading,
  actionsDisabled,
  colors,
  itemId,
  onAction,
  status,
}: NegotiationDecisionControlsProps) {
  if (status !== 'pending') {
    return (
      <View style={styles.statusOutcomeRow}>
        <Text
          style={[styles.statusOutcomeLabel, { color: colors.textSecondary }]}
        >
          Status
        </Text>
        <View
          style={[
            styles.statusOutcomeBadge,
            status === 'accepted' && {
              backgroundColor: colors.successLight,
            },
            status === 'rejected' && {
              backgroundColor: colors.errorLight,
            },
            status === 'countered' && {
              backgroundColor: colors.warningLight,
            },
          ]}
        >
          <Text
            style={[
              styles.statusOutcomeText,
              status === 'accepted' && { color: colors.success },
              status === 'rejected' && { color: colors.error },
              status === 'countered' && { color: colors.warning },
            ]}
          >
            {formatNegotiationStatus(status)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.actionRow}>
      <Pressable
        style={[
          styles.actionButton,
          styles.rejectButton,
          { borderColor: colors.border },
          (actionLoading || actionsDisabled) && styles.disabledButton,
        ]}
        onPress={() => onAction(itemId, 'rejected')}
        disabled={actionsDisabled}
      >
        {actionLoading ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Text
            style={[styles.rejectButtonText, { color: colors.textSecondary }]}
          >
            Reject
          </Text>
        )}
      </Pressable>
      <Pressable
        style={[
          styles.actionButton,
          styles.acceptButton,
          { backgroundColor: colors.primary },
          (actionLoading || actionsDisabled) && styles.disabledButton,
        ]}
        onPress={() => onAction(itemId, 'accepted')}
        disabled={actionsDisabled}
      >
        {actionLoading ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Text
            style={[styles.acceptButtonText, { color: colors.textOnPrimary }]}
          >
            Accept Offer
          </Text>
        )}
      </Pressable>
    </View>
  );
}
