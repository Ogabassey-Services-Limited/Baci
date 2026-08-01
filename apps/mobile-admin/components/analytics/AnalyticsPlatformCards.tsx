import Ionicons from '@react-native-vector-icons/ionicons';
import type React from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import type { ThemeColors, ThemeShadows } from '@/constants/theme';
import type { AnalyticsState } from '@/lib/analytics-config-diff';
import { analyticsConfigStyles as styles } from './analytics-config.styles';
import { analyticsPlatformConfigs } from './analytics-platform-config';

interface AnalyticsPlatformCardsProps {
  analytics: AnalyticsState;
  colors: ThemeColors;
  expandedSection: string | null;
  onToggleSection: (section: string) => void;
  shadows: ThemeShadows;
  updateField: (field: keyof AnalyticsState, value: string | boolean) => void;
}

interface AnalyticsPlatformCardProps {
  children: React.ReactNode;
  colors: ThemeColors;
  helpLink: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  isConfigured: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  shadows: ThemeShadows;
  title: string;
}

function AnalyticsPlatformCard({
  children,
  colors,
  helpLink,
  icon,
  iconColor,
  isConfigured,
  isExpanded,
  onToggle,
  shadows,
  title,
}: AnalyticsPlatformCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <Pressable
        accessibilityLabel={`${title} analytics credentials, ${isConfigured ? 'configured' : 'not configured'}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={onToggle}
        style={styles.cardHeader}
      >
        <View style={styles.cardTitleRow}>
          <View
            style={[styles.iconBadge, { backgroundColor: `${iconColor}15` }]}
          >
            <Ionicons name={icon} size={22} color={iconColor} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {title}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isConfigured
                      ? '#22c55e'
                      : colors.textMuted,
                  },
                ]}
              />
              <Text
                style={[styles.statusText, { color: colors.textSecondary }]}
              >
                {isConfigured ? 'Configured' : 'Not configured'}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.cardContent}>
          <Pressable
            accessibilityLabel={`How to get your ${title} credentials`}
            accessibilityRole="button"
            style={styles.helpLink}
            onPress={() => Linking.openURL(helpLink)}
          >
            <Ionicons
              name="help-circle-outline"
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.helpText, { color: colors.primary }]}>
              How to get your {title} credentials
            </Text>
          </Pressable>
          {children}
        </View>
      )}
    </View>
  );
}

interface AnalyticsCredentialInputProps {
  colors: ThemeColors;
  field: Exclude<keyof AnalyticsState, 'offline_conversions_enabled'>;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onUpdateField: (field: keyof AnalyticsState, value: string | boolean) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
}

function AnalyticsCredentialInput({
  colors,
  field,
  icon,
  label,
  onUpdateField,
  placeholder,
  secureTextEntry = false,
  value,
}: AnalyticsCredentialInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputContainer,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={(nextValue) => onUpdateField(field, nextValue)}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

export function AnalyticsPlatformCards({
  analytics,
  colors,
  expandedSection,
  onToggleSection,
  shadows,
  updateField,
}: AnalyticsPlatformCardsProps) {
  return analyticsPlatformConfigs.map((platform) => {
    const iconColor =
      platform.iconColor === 'theme-text' ? colors.text : platform.iconColor;
    const isConfigured = platform.fields.every(({ field }) =>
      Boolean(analytics[field])
    );

    return (
      <AnalyticsPlatformCard
        key={platform.id}
        title={platform.title}
        icon={platform.icon}
        iconColor={iconColor}
        isExpanded={expandedSection === platform.id}
        onToggle={() => onToggleSection(platform.id)}
        helpLink={platform.helpLink}
        isConfigured={isConfigured}
        colors={colors}
        shadows={shadows}
      >
        {platform.fields.map((field) => (
          <AnalyticsCredentialInput
            key={field.field}
            {...field}
            colors={colors}
            value={analytics[field.field]}
            onUpdateField={updateField}
          />
        ))}
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {platform.hint}
        </Text>
      </AnalyticsPlatformCard>
    );
  });
}
