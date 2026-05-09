import type { ImeiServiceTierDefinition } from '@baci/shared/imei';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND, withAlpha } from '@/constants/Colors';
import type { ImeiResult } from '@/lib/validation';
import { getVerdictColors } from './get-verdict-colors';
import { styles } from './imei-check.styles';
import type { ImeiCheckerColors } from './imei-check.types';
import { isStatusClean } from './is-status-clean';

interface ImeiCheckResultViewProps {
  colors: ImeiCheckerColors;
  currentTier: ImeiServiceTierDefinition;
  result: ImeiResult;
  onReset: () => void;
}

export function ImeiCheckResultView({
  colors,
  currentTier,
  result,
  onReset,
}: ImeiCheckResultViewProps) {
  const verdictColors = getVerdictColors(result.verdictType);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <Stack.Screen
        options={{
          title: 'IMEI Results',
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.resultHeader,
            { backgroundColor: colors.card, borderColor: verdictColors.border },
          ]}
        >
          <DeviceImage result={result} colors={colors} />
          <View style={styles.deviceInfo}>
            <Text style={[styles.tierBadge, { color: colors.textSecondary }]}>
              {currentTier.name} Report
            </Text>
            <Text style={[styles.deviceName, { color: colors.text }]}>
              {result.device}
            </Text>
            <Text style={[styles.imeiText, { color: colors.textSecondary }]}>
              IMEI: {result.imei}
            </Text>
            {result.modelNumber && (
              <Text style={[styles.modelText, { color: colors.textSecondary }]}>
                Model: {result.modelNumber}
              </Text>
            )}
          </View>
          <TrustScore result={result} colors={colors} />
        </View>

        <View style={styles.statusGrid}>
          <StatusCard
            colors={colors}
            icon="shield-checkmark"
            label="Blacklist Status"
            value={result.blacklistStatus}
            cleanAware
          />
          {result.activationStatus && (
            <StatusCard
              colors={colors}
              icon="sparkles"
              label="Activation Status"
              value={result.activationStatus}
              tint={BRAND.primary}
            />
          )}
          <StatusCard
            colors={colors}
            icon="lock-closed"
            label="Find My iPhone"
            value={result.icloudLock}
            cleanAware
          />
          <StatusCard
            colors={colors}
            icon="globe"
            label="SIM Lock"
            value={result.simLock}
            tint="#2563EB"
          />
          <StatusCard
            colors={colors}
            icon="cellular"
            label="Carrier"
            value={result.carrier}
            tint="#7C3AED"
          />
        </View>

        <View
          style={[
            styles.verdictContainer,
            {
              backgroundColor: verdictColors.bg,
              borderColor: verdictColors.border,
            },
          ]}
        >
          <Text style={[styles.verdictText, { color: verdictColors.text }]}>
            {result.verdict}
          </Text>
        </View>

        <Pressable
          style={[
            styles.resetButton,
            {
              backgroundColor: withAlpha(BRAND.primary, 0.06),
              borderColor: withAlpha(BRAND.primary, 0.18),
            },
          ]}
          onPress={onReset}
        >
          <Ionicons name="scan-outline" size={18} color={BRAND.primary} />
          <Text style={[styles.resetButtonText, { color: BRAND.primary }]}>
            Check Another Device
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DeviceImage({
  colors,
  result,
}: {
  colors: ImeiCheckerColors;
  result: ImeiResult;
}) {
  return (
    <View style={styles.deviceImageContainer}>
      {result.deviceImage ? (
        <Image
          source={{ uri: result.deviceImage }}
          style={styles.deviceImage}
          contentFit="contain"
        />
      ) : (
        <Ionicons
          name="phone-portrait-outline"
          size={48}
          color={colors.textSecondary}
        />
      )}
    </View>
  );
}

function TrustScore({
  colors,
  result,
}: {
  colors: ImeiCheckerColors;
  result: ImeiResult;
}) {
  const isClean = result.status === 'Clean';

  return (
    <View
      style={[
        styles.scoreContainer,
        { backgroundColor: isClean ? '#DEF7EC' : '#FEE2E2' },
      ]}
    >
      <Text
        style={[styles.scoreValue, { color: isClean ? '#059669' : '#DC2626' }]}
      >
        {result.score}%
      </Text>
      <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
        Trust
      </Text>
    </View>
  );
}

function StatusCard({
  cleanAware = false,
  colors,
  icon,
  label,
  tint,
  value,
}: {
  cleanAware?: boolean;
  colors: ImeiCheckerColors;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
  value: string;
}) {
  const clean = isStatusClean(value);
  const color = cleanAware
    ? clean
      ? '#059669'
      : '#DC2626'
    : tint || colors.text;
  const backgroundColor = cleanAware
    ? clean
      ? '#DEF7EC'
      : '#FEE2E2'
    : withAlpha(color, 0.12);

  return (
    <View
      style={[
        styles.statusCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.statusIcon, { backgroundColor }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.statusInfo}>
        <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.statusValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}
