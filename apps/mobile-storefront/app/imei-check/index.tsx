/**
 * IMEI Checker Screen
 * Verify phone IMEI status before buying
 * Check for stolen devices, iCloud locks, and carrier restrictions
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import {
  ImeiCheckApiResponseSchema,
  type ImeiResult,
  isValidIMEI,
  parseApiResponse,
} from '@/lib/validation';

const log = createLogger('ImeiChecker');

// Service tiers for IMEI checking
const SERVICE_TIERS = {
  basic: {
    id: 'basic',
    name: 'Quick ID',
    tagline: 'What phone is this?',
    price: 100,
    priceDisplay: '100',
    features: ['Device Model', 'Model Number'],
    icon: 'phone-portrait-outline' as const,
  },
  blacklist: {
    id: 'blacklist',
    name: 'Stolen Check',
    tagline: 'Is it reported stolen?',
    price: 300,
    priceDisplay: '300',
    features: ['Device Model', 'Blacklist Status', 'GSMA Database'],
    icon: 'shield-outline' as const,
  },
  carrier: {
    id: 'carrier',
    name: 'Network Check',
    tagline: 'Will my SIM work?',
    price: 500,
    priceDisplay: '500',
    features: ['Device Model', 'Original Carrier', 'SIM Lock Status'],
    icon: 'globe-outline' as const,
  },
  icloud: {
    id: 'icloud',
    name: 'iCloud Check',
    tagline: 'Is Find My on?',
    price: 800,
    priceDisplay: '800',
    features: ['Device Model', 'iCloud Lock', 'Activation Status'],
    icon: 'lock-closed-outline' as const,
  },
  full: {
    id: 'full',
    name: 'Full Report',
    tagline: 'Know everything',
    price: 1500,
    priceDisplay: '1,500',
    features: [
      'Device Model',
      'iCloud Status',
      'Blacklist Check',
      'Carrier Info',
      'SIM Lock',
      'Trust Score',
    ],
    icon: 'checkmark-circle-outline' as const,
    recommended: true,
  },
} as const;

type ServiceTier = keyof typeof SERVICE_TIERS;

// Using ImeiResult type from validation.ts

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ogabassey.com';

export default function ImeiCheckerScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [imei, setImei] = useState('');
  const [selectedTier, setSelectedTier] = useState<ServiceTier>('full');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImeiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImeiChange = (text: string) => {
    // Only allow digits, max 15
    const cleaned = text.replace(/\D/g, '').slice(0, 15);
    setImei(cleaned);
  };

  const handleCheck = async () => {
    // 2026 Best Practice: Dismiss keyboard on submit
    Keyboard.dismiss();

    // Bug #M23: Prevent double-tap on IMEI check button
    if (isLoading) return;

    if (!isValidIMEI(imei)) {
      Alert.alert('Invalid IMEI', 'Please enter a valid 15-digit IMEI number.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    // Bug #M22: Add AbortController with 30s timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/storefront/imei-check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imei, tier: selectedTier }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const rawData = await response.json();

      // Bug #66: Check for HTTP errors and API-level errors BEFORE Zod validation
      if (!response.ok || rawData?.error) {
        setError(rawData?.error || 'Unable to check IMEI. Please try again.');
        return;
      }

      // 2026 Best Practice: Validate API response with Zod
      const validated = parseApiResponse(
        ImeiCheckApiResponseSchema,
        rawData,
        'IMEI check API'
      );

      if (!validated || !validated.success) {
        setError('Invalid response from server. Please try again.');
        return;
      }

      const resultData = validated.data;
      if (!resultData) {
        setError('No data returned from server. Please try again.');
        return;
      }

      setResult(resultData);
    } catch (err) {
      clearTimeout(timeoutId);
      log.error('IMEI check failed:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          'Request timed out. Please check your connection and try again.'
        );
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setImei('');
  };

  const currentTier = SERVICE_TIERS[selectedTier];

  const getVerdictColors = (type: 'safe' | 'caution' | 'danger') => {
    switch (type) {
      case 'safe':
        return { bg: '#DEF7EC', text: '#059669', border: '#A7F3D0' };
      case 'danger':
        return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
      default:
        return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
    }
  };

  const isStatusClean = (status: string) => {
    const s = status.toLowerCase();
    return (
      s === 'clean' || s === 'not found' || s.includes('clean') || s === 'off'
    );
  };

  // Results View
  if (result) {
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
          {/* Device Header */}
          <View
            style={[
              styles.resultHeader,
              {
                backgroundColor:
                  result.status === 'Clean' ? '#F0FDF4' : '#FEF2F2',
              },
            ]}
          >
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
                <Text
                  style={[styles.modelText, { color: colors.textSecondary }]}
                >
                  Model: {result.modelNumber}
                </Text>
              )}
            </View>

            <View
              style={[
                styles.scoreContainer,
                {
                  backgroundColor:
                    result.status === 'Clean' ? '#DEF7EC' : '#FEE2E2',
                },
              ]}
            >
              <Text
                style={[
                  styles.scoreValue,
                  { color: result.status === 'Clean' ? '#059669' : '#DC2626' },
                ]}
              >
                {result.score}%
              </Text>
              <Text
                style={[styles.scoreLabel, { color: colors.textSecondary }]}
              >
                Trust
              </Text>
            </View>
          </View>

          {/* Status Grid */}
          <View style={styles.statusGrid}>
            {/* Blacklist Status */}
            <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
              <View
                style={[
                  styles.statusIcon,
                  {
                    backgroundColor: isStatusClean(result.blacklistStatus)
                      ? '#DEF7EC'
                      : '#FEE2E2',
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color={
                    isStatusClean(result.blacklistStatus)
                      ? '#059669'
                      : '#DC2626'
                  }
                />
              </View>
              <View style={styles.statusInfo}>
                <Text
                  style={[styles.statusLabel, { color: colors.textSecondary }]}
                >
                  Blacklist Status
                </Text>
                <Text
                  style={[
                    styles.statusValue,
                    {
                      color: isStatusClean(result.blacklistStatus)
                        ? '#059669'
                        : '#DC2626',
                    },
                  ]}
                >
                  {result.blacklistStatus}
                </Text>
              </View>
            </View>

            {/* iCloud Lock */}
            <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
              <View
                style={[
                  styles.statusIcon,
                  {
                    backgroundColor: isStatusClean(result.icloudLock)
                      ? '#DEF7EC'
                      : '#FEE2E2',
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed"
                  size={20}
                  color={
                    isStatusClean(result.icloudLock) ? '#059669' : '#DC2626'
                  }
                />
              </View>
              <View style={styles.statusInfo}>
                <Text
                  style={[styles.statusLabel, { color: colors.textSecondary }]}
                >
                  Find My iPhone
                </Text>
                <Text
                  style={[
                    styles.statusValue,
                    {
                      color: isStatusClean(result.icloudLock)
                        ? '#059669'
                        : '#DC2626',
                    },
                  ]}
                >
                  {result.icloudLock}
                </Text>
              </View>
            </View>

            {/* SIM Lock */}
            <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statusIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="globe" size={20} color="#2563EB" />
              </View>
              <View style={styles.statusInfo}>
                <Text
                  style={[styles.statusLabel, { color: colors.textSecondary }]}
                >
                  SIM Lock
                </Text>
                <Text style={[styles.statusValue, { color: colors.text }]}>
                  {result.simLock}
                </Text>
              </View>
            </View>

            {/* Carrier */}
            <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statusIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="cellular" size={20} color="#7C3AED" />
              </View>
              <View style={styles.statusInfo}>
                <Text
                  style={[styles.statusLabel, { color: colors.textSecondary }]}
                >
                  Carrier
                </Text>
                <Text style={[styles.statusValue, { color: colors.text }]}>
                  {result.carrier}
                </Text>
              </View>
            </View>
          </View>

          {/* Verdict */}
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

          {/* Check Another */}
          <Pressable style={styles.resetButton} onPress={handleReset}>
            <Ionicons name="scan-outline" size={18} color={BRAND.primary} />
            <Text style={[styles.resetButtonText, { color: BRAND.primary }]}>
              Check Another Device
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Check Form View
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <Stack.Screen
        options={{
          title: 'IMEI Checker',
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <AppKeyboardContainer style={styles.keyboardView}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View
              style={[styles.badge, { backgroundColor: `${BRAND.primary}15` }]}
            >
              <Ionicons
                name="shield-checkmark"
                size={14}
                color={BRAND.primary}
              />
              <Text style={[styles.badgeText, { color: BRAND.primary }]}>
                Trusted by 10,000+ Buyers
              </Text>
            </View>

            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Don't Get Scammed.{'\n'}
              <Text style={{ color: BRAND.primary }}>Verify First.</Text>
            </Text>

            <Text
              style={[styles.heroSubtitle, { color: colors.textSecondary }]}
            >
              That "Brand New" iPhone might be stolen, iCloud locked, or
              refurbished. One quick check can save you from losing money.
            </Text>

            <View style={styles.trustIndicators}>
              <View style={styles.trustItem}>
                <Ionicons name="checkmark" size={14} color="#059669" />
                <Text
                  style={[styles.trustText, { color: colors.textSecondary }]}
                >
                  Instant
                </Text>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="checkmark" size={14} color="#059669" />
                <Text
                  style={[styles.trustText, { color: colors.textSecondary }]}
                >
                  Official DB
                </Text>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="checkmark" size={14} color="#059669" />
                <Text
                  style={[styles.trustText, { color: colors.textSecondary }]}
                >
                  Accurate
                </Text>
              </View>
            </View>
          </View>

          {/* Service Tier Selection */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Choose verification level:
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tierScroll}
            contentContainerStyle={styles.tierScrollContent}
          >
            {(Object.keys(SERVICE_TIERS) as ServiceTier[]).map((tierKey) => {
              const tier = SERVICE_TIERS[tierKey];
              const isSelected = selectedTier === tierKey;

              return (
                <Pressable
                  key={tierKey}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? BRAND.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedTier(tierKey)}
                >
                  {'recommended' in tier && tier.recommended && (
                    <View style={styles.recommendedBadge}>
                      <Ionicons name="star" size={10} color="#FFF" />
                      <Text style={styles.recommendedText}>BEST</Text>
                    </View>
                  )}
                  <Ionicons
                    name={tier.icon}
                    size={24}
                    color={isSelected ? BRAND.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tierName,
                      { color: isSelected ? BRAND.primary : colors.text },
                    ]}
                  >
                    {tier.name}
                  </Text>
                  <Text
                    style={[
                      styles.tierTagline,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {tier.tagline}
                  </Text>
                  <Text
                    style={[
                      styles.tierPrice,
                      { color: isSelected ? BRAND.primary : colors.text },
                    ]}
                  >
                    {tier.priceDisplay}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <Text
              style={[styles.featuresLabel, { color: colors.textSecondary }]}
            >
              What's included:
            </Text>
            <View style={styles.featuresList}>
              {currentTier.features.map((feature) => (
                <View
                  key={feature}
                  style={[styles.featureTag, { backgroundColor: colors.card }]}
                >
                  <Ionicons name="checkmark" size={12} color="#059669" />
                  <Text
                    style={[
                      styles.featureText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* IMEI Input */}
          <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="barcode-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.imeiInput, { color: colors.text }]}
                value={imei}
                onChangeText={handleImeiChange}
                placeholder="Enter 15-digit IMEI"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={15}
                // 2026 Best Practice: Better keyboard UX
                returnKeyType="go"
                onSubmitEditing={handleCheck}
                autoComplete="off"
              />
              {imei.length > 0 && (
                <Pressable onPress={() => setImei('')}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>

            <Text style={[styles.imeiCount, { color: colors.textSecondary }]}>
              {imei.length}/15 digits
            </Text>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* How to Find IMEI */}
          <View style={[styles.helpCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.helpTitle, { color: colors.text }]}>
              How to find your IMEI:
            </Text>
            <View style={styles.helpSteps}>
              <View style={styles.helpStep}>
                <View style={styles.helpStepNumber}>
                  <Text style={styles.helpStepNumberText}>1</Text>
                </View>
                <Text style={[styles.helpStepText, { color: colors.text }]}>
                  Dial <Text style={styles.helpBold}>*#06#</Text>
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.textSecondary}
              />
              <View style={styles.helpStep}>
                <View style={styles.helpStepNumber}>
                  <Text style={styles.helpStepNumberText}>2</Text>
                </View>
                <Text style={[styles.helpStepText, { color: colors.text }]}>
                  Copy 15 digits
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.textSecondary}
              />
              <View style={styles.helpStep}>
                <View style={styles.helpStepNumber}>
                  <Text style={styles.helpStepNumberText}>3</Text>
                </View>
                <Text style={[styles.helpStepText, { color: colors.text }]}>
                  Paste above
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Action */}
        <View
          style={[
            styles.bottomAction,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.verifyButton,
              { backgroundColor: BRAND.primary },
              (isLoading || imei.length < 15) && styles.verifyButtonDisabled,
            ]}
            onPress={handleCheck}
            disabled={isLoading || imei.length < 15}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.verifyButtonText}>
                  Verify Now - {currentTier.priceDisplay}
                </Text>
                <Ionicons name="sparkles" size={18} color="#FFF" />
              </>
            )}
          </Pressable>
        </View>
      </AppKeyboardContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.sm, // Reduced padding for tighter layout
    paddingTop: 0,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 0,
    marginTop: -8, // Pull content up significantly
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    marginBottom: SPACING.sm, // Reduced from MD
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  trustIndicators: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  tierScroll: {
    marginBottom: SPACING.md,
  },
  tierScrollContent: {
    paddingHorizontal: SPACING.xs,
    gap: SPACING.sm,
  },
  tierCard: {
    width: 110,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    alignItems: 'center',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  recommendedText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  tierName: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  tierTagline: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  tierPrice: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  featuresContainer: {
    marginBottom: SPACING.lg,
  },
  featuresLabel: {
    fontSize: 12,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 11,
  },
  inputCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  imeiInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  imeiCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FEE2E2',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },
  helpCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  helpTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  helpSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  helpStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  helpStepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: `${BRAND.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpStepNumberText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.primary,
  },
  helpStepText: {
    fontSize: 11,
  },
  helpBold: {
    fontWeight: '700',
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    borderTopWidth: 1,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Results styles
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md, // Reduced from LG
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm, // Reduced from MD
  },
  deviceImageContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  deviceImage: {
    width: 60,
    height: 60,
  },
  deviceInfo: {
    flex: 1,
  },
  tierBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  imeiText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  modelText: {
    fontSize: 10,
    marginTop: 2,
  },
  scoreContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusGrid: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  verdictContainer: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  verdictText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
