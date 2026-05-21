import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { Domain, DomainAction } from './domain-types';
import { domainOptionsSheetStyles } from './domain-options-sheet.styles';

interface ActionButtonProps {
  action: DomainAction;
  hint: string;
  iconColor: string;
  iconName: 'open-outline' | 'shield-checkmark-outline' | 'star-outline' | 'trash-outline';
  iconTone: string;
  label: string;
  onAction: (action: DomainAction) => void;
  pressedTone?: string;
  subtext?: string;
  textColor?: string;
}

function ActionButton({
  action,
  hint,
  iconColor,
  iconName,
  iconTone,
  label,
  onAction,
  pressedTone,
  subtext,
  textColor,
}: ActionButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        domainOptionsSheetStyles.actionButton,
        {
          backgroundColor: pressed ? (pressedTone ?? iconTone) : 'transparent',
        },
      ]}
      onPress={() => onAction(action)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <View
        style={[
          domainOptionsSheetStyles.actionIcon,
          { backgroundColor: iconTone },
        ]}
      >
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            domainOptionsSheetStyles.actionText,
            { color: textColor ?? colors.text },
          ]}
        >
          {label}
        </Text>
        {subtext && (
          <Text
            style={[
              domainOptionsSheetStyles.actionSubtext,
              { color: colors.textSecondary },
            ]}
          >
            {subtext}
          </Text>
        )}
      </View>
      {!textColor && (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

interface DomainOptionsSheetActionsProps {
  domain: Domain;
  onAction: (action: DomainAction) => void;
}

export default function DomainOptionsSheetActions({
  domain,
  onAction,
}: DomainOptionsSheetActionsProps) {
  const { colors } = useTheme();

  return (
    <View style={domainOptionsSheetStyles.actionsList}>
      <ActionButton
        action="visit"
        hint={`Opens ${domain.domain} in a web browser`}
        iconColor={colors.text}
        iconName="open-outline"
        iconTone={colors.background}
        label="Visit Site"
        onAction={onAction}
        pressedTone={colors.background}
      />

      {domain.domain_type === 'custom' && domain.status !== 'active' && (
        <ActionButton
          action="verify"
          hint="Checks if DNS records are correctly configured to take site live"
          iconColor={colors.warning}
          iconName="shield-checkmark-outline"
          iconTone={colors.warningLight}
          label="Verify DNS Connection"
          onAction={onAction}
          pressedTone={colors.background}
          subtext="Required to take site live"
        />
      )}

      {!domain.is_primary && domain.status === 'active' && (
        <ActionButton
          action="set_primary"
          hint="Makes this domain your main store link"
          iconColor={colors.primary}
          iconName="star-outline"
          iconTone={colors.primaryLight}
          label="Set as Primary Domain"
          onAction={onAction}
          pressedTone={colors.background}
          subtext="Make this your main store link"
        />
      )}

      {!domain.is_primary && (
        <>
          <View
            style={[
              domainOptionsSheetStyles.separator,
              { backgroundColor: colors.border },
            ]}
          />
          <ActionButton
            action="delete"
            hint="Permanently removes this domain from your store"
            iconColor={colors.error}
            iconName="trash-outline"
            iconTone={colors.errorLight}
            label="Delete Domain"
            onAction={onAction}
            pressedTone={colors.errorLight}
            textColor={colors.error}
          />
        </>
      )}
    </View>
  );
}
