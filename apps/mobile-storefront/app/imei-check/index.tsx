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
import Colors, { BRAND, RADIUS, SPACING, withAlpha } from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import {
  ImeiCheckApiResponseSchema,
  type ImeiResult,
  isValidIMEI,
  parseApiResponse,
} from '@/lib/validation';

const log = createLogger('ImeiChecker');

const BRAND_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'apple', label: 'Apple' },
  { id: 'samsung', label: 'Samsung' },
  { id: 'android', label: 'Android' },
] as const;

type BrandFilter = (typeof BRAND_FILTERS)[number]['id'];
type ServiceBrandScope = BrandFilter;

// Service tiers for IMEI checking
const SERVICE_TIERS = {
  full: {
    id: 'full',
    name: 'Full Report',
    tagline: 'Know everything',
    price: 1500,
    detail:
      'Best first check for used iPhones: network, Find My and stolen/lost status in one report.',
    features: [
      'Device Model & Number',
      'Serial Number',
      'iCloud / Find My Status',
      'Blacklist / Stolen Status',
      'Carrier / Network Info',
      'SIM Lock Status',
      'Activation Status',
      'Purchase Date',
      'Purchase Country',
      'Warranty Status',
      'Refurbished / Demo Flags',
      'Trust Score',
      'Buy / No-Buy Verdict',
    ],
    icon: 'checkmark-circle-outline' as const,
    recommended: true,
    brandScopes: ['all'] satisfies ServiceBrandScope[],
  },
  activation: {
    id: 'activation',
    name: 'Non-Active Status PRO',
    tagline: 'Is it actually brand new?',
    price: 700,
    detail:
      'Checks if Apple says the device has been activated. Useful when a seller claims a phone is brand new.',
    features: [
      'Activation Status',
      'Purchase Date',
      'Purchase Country',
      'Warranty Status',
      'Model / Serial',
    ],
    icon: 'sparkles-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  blacklist: {
    id: 'blacklist',
    name: 'Stolen Check',
    tagline: 'Is it reported stolen?',
    price: 700,
    detail: 'Checks worldwide lost/stolen blacklist records before you pay.',
    features: ['Device Model', 'Blacklist Status', 'GSMA Database'],
    icon: 'shield-outline' as const,
    brandScopes: ['all'] satisfies ServiceBrandScope[],
  },
  blacklistPro: {
    id: 'blacklistPro',
    name: 'Stolen Check PRO',
    tagline: 'Deeper blacklist lookup',
    price: 2000,
    detail:
      'A deeper worldwide blacklist check for higher-risk devices or expensive purchases.',
    features: ['Worldwide Blacklist', 'Lost/Stolen Status', 'GSMA Database'],
    icon: 'shield-checkmark-outline' as const,
    brandScopes: ['all'] satisfies ServiceBrandScope[],
  },
  carrier: {
    id: 'carrier',
    name: 'Network Check',
    tagline: 'Will my SIM work?',
    price: 1000,
    detail:
      'Shows the iPhone carrier/network so you know what network it belongs to.',
    features: ['Original Carrier', 'Network Info', 'Device Model'],
    icon: 'globe-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  simLock: {
    id: 'simLock',
    name: 'SIM Lock',
    tagline: 'Can it use any SIM?',
    price: 500,
    detail:
      'Checks whether the iPhone is locked to one carrier or open for other SIM cards.',
    features: ['SIM Lock Status', 'Carrier Lock Risk', 'Device Model'],
    icon: 'phone-portrait-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  icloud: {
    id: 'icloud',
    name: 'Find My Check',
    tagline: 'Is Find My on?',
    price: 300,
    detail:
      'Checks whether Find My/iCloud lock is on before you buy the device.',
    features: ['Find My Status', 'iCloud Lock Risk', 'Device Model'],
    icon: 'lock-closed-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  icloudPro: {
    id: 'icloudPro',
    name: 'iCloud Lost Check PRO',
    tagline: 'Clean or lost?',
    price: 3500,
    detail:
      'Checks if an iPhone or Mac is clean or marked lost in iCloud-related records.',
    features: ['Clean/Lost Status', 'iCloud Risk', 'iPhone & Mac Support'],
    icon: 'lock-closed-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  carrierFmi: {
    id: 'carrierFmi',
    name: 'Network + Find My',
    tagline: 'Carrier and FMI',
    price: 1300,
    detail:
      'Combines carrier/network information with Find My status for Apple devices.',
    features: ['Carrier Info', 'Find My Status', 'Device Model'],
    icon: 'globe-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  basic: {
    id: 'basic',
    name: 'Quick ID',
    tagline: 'What phone is this?',
    price: 300,
    detail: 'Identifies the brand and model from an IMEI or serial number.',
    features: ['Brand', 'Device Model', 'Model Number'],
    icon: 'phone-portrait-outline' as const,
    brandScopes: ['all'] satisfies ServiceBrandScope[],
  },
  appleBasic: {
    id: 'appleBasic',
    name: 'Apple Basic Info',
    tagline: 'Apple model details',
    price: 800,
    detail: 'Basic Apple device information before running deeper paid checks.',
    features: ['Apple Model', 'Model Number', 'Device Family'],
    icon: 'information-circle-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  serialInfo: {
    id: 'serialInfo',
    name: 'Serial Info',
    tagline: 'Apple serial lookup',
    price: 200,
    detail:
      'Looks up Apple serial information when the seller provides a serial number.',
    features: ['Serial Number', 'Apple Device Info', 'Model Details'],
    icon: 'barcode-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  replacementHistory: {
    id: 'replacementHistory',
    name: 'Replacement History',
    tagline: 'Has Apple replaced it?',
    price: 11500,
    detail:
      'Checks whether Apple replacement or repair history exists for the device.',
    features: ['Replacement History', 'Repair History', 'Apple Records'],
    icon: 'refresh-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  demoUnit: {
    id: 'demoUnit',
    name: 'Demo Unit Check',
    tagline: 'Was it a store demo?',
    price: 3300,
    detail: 'Checks whether the device appears to be a retail demo unit.',
    features: ['Demo Unit Status', 'Retail Demo Risk', 'Apple Device Info'],
    icon: 'storefront-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  mdm: {
    id: 'mdm',
    name: 'MDM Lock Check',
    tagline: 'Company/school lock',
    price: 5000,
    detail:
      'Checks for mobile device management risk, common on company or school-owned devices.',
    features: ['MDM Status', 'Management Lock Risk', 'Apple Device Info'],
    icon: 'briefcase-outline' as const,
    brandScopes: ['apple'] satisfies ServiceBrandScope[],
  },
  samsung: {
    id: 'samsung',
    name: 'Samsung Info',
    tagline: 'Samsung device info',
    price: 1000,
    detail: 'Basic Samsung device information from IMEI.',
    features: ['Samsung Model', 'Device Info', 'IMEI Lookup'],
    icon: 'phone-portrait-outline' as const,
    brandScopes: ['samsung'] satisfies ServiceBrandScope[],
  },
  samsungPro: {
    id: 'samsungPro',
    name: 'Samsung Info PRO',
    tagline: 'Detailed Samsung info',
    price: 1500,
    detail: 'A deeper Samsung device information check.',
    features: ['Samsung Model', 'Detailed Device Info', 'IMEI Lookup'],
    icon: 'phone-portrait-outline' as const,
    brandScopes: ['samsung'] satisfies ServiceBrandScope[],
  },
  miLock: {
    id: 'miLock',
    name: 'Mi Lock Check',
    tagline: 'Xiaomi account lock',
    price: 1500,
    detail: 'Checks Xiaomi, Redmi and Poco account lock status.',
    features: ['Mi Lock Status', 'Xiaomi / Redmi / Poco', 'Device Info'],
    icon: 'lock-closed-outline' as const,
    brandScopes: ['android'] satisfies ServiceBrandScope[],
  },
  miLostPro: {
    id: 'miLostPro',
    name: 'Mi Lost Check PRO',
    tagline: 'Clean or lost?',
    price: 8000,
    detail:
      'Checks whether a Xiaomi, Redmi or Poco device appears clean or lost.',
    features: ['Mi Lock Clean/Lost', 'Xiaomi / Redmi / Poco', 'Device Info'],
    icon: 'shield-checkmark-outline' as const,
    brandScopes: ['android'] satisfies ServiceBrandScope[],
  },
  pixel: {
    id: 'pixel',
    name: 'Pixel Info',
    tagline: 'Google Pixel details',
    price: 2000,
    detail: 'Google Pixel device information from IMEI.',
    features: ['Pixel Model', 'Device Info', 'IMEI Lookup'],
    icon: 'phone-portrait-outline' as const,
    brandScopes: ['android'] satisfies ServiceBrandScope[],
  },
  oppoRealme: {
    id: 'oppoRealme',
    name: 'Oppo/Realme Info',
    tagline: 'Oppo, OnePlus, Realme',
    price: 3300,
    detail: 'Device information for Oppo, OnePlus and Realme phones.',
    features: ['Oppo / OnePlus / Realme', 'Device Info', 'IMEI Lookup'],
    icon: 'phone-portrait-outline' as const,
    brandScopes: ['android'] satisfies ServiceBrandScope[],
  },
  transsion: {
    id: 'transsion',
    name: 'Tecno/Infinix Info',
    tagline: 'Tecno, Infinix, Itel',
    price: 500,
    detail: 'Device information for Tecno, Infinix, Itel and Sonim phones.',
    features: ['Tecno / Infinix / Itel', 'Device Info', 'IMEI Lookup'],
    icon: 'phone-portrait-outline' as const,
    brandScopes: ['android'] satisfies ServiceBrandScope[],
  },
} as const;

type ServiceTier = keyof typeof SERVICE_TIERS;

const PRIMARY_SERVICE_TIERS = [
  'full',
  'activation',
  'blacklist',
  'carrier',
] satisfies ServiceTier[];
const ALL_SERVICE_TIERS = Object.keys(SERVICE_TIERS) as ServiceTier[];

function tierMatchesBrand(tierKey: ServiceTier, brand: BrandFilter): boolean {
  const scopes: readonly ServiceBrandScope[] =
    SERVICE_TIERS[tierKey].brandScopes;
  return brand === 'all' || scopes.includes('all') || scopes.includes(brand);
}

function getVisibleServiceTiers(
  brand: BrandFilter,
  expanded: boolean
): ServiceTier[] {
  const baseTiers = expanded ? ALL_SERVICE_TIERS : PRIMARY_SERVICE_TIERS;
  return baseTiers.filter((tierKey) => tierMatchesBrand(tierKey, brand));
}

// Using ImeiResult type from validation.ts

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ogabassey.com';

function formatServicePrice(price: number): string {
  return `₦${price.toLocaleString('en-NG')}`;
}

export default function ImeiCheckerScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [imei, setImei] = useState('');
  const [selectedTier, setSelectedTier] = useState<ServiceTier>('full');
  const [selectedBrand, setSelectedBrand] = useState<BrandFilter>('all');
  const [showAllServices, setShowAllServices] = useState(false);
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

      if (!validated?.success) {
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
  const visibleServiceTiers = getVisibleServiceTiers(
    selectedBrand,
    showAllServices
  );
  const displayedServiceTiers =
    visibleServiceTiers.length > 0
      ? visibleServiceTiers
      : PRIMARY_SERVICE_TIERS;

  const handleBrandSelect = (brand: BrandFilter) => {
    setSelectedBrand(brand);
    const nextVisibleTiers = getVisibleServiceTiers(brand, showAllServices);
    if (!nextVisibleTiers.includes(selectedTier)) {
      setSelectedTier('full');
    }
  };

  const handleToggleServices = () => {
    const nextExpanded = !showAllServices;
    setShowAllServices(nextExpanded);
    const nextVisibleTiers = getVisibleServiceTiers(
      selectedBrand,
      nextExpanded
    );
    if (!nextVisibleTiers.includes(selectedTier)) {
      setSelectedTier('full');
    }
  };

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
                backgroundColor: colors.card,
                borderColor: verdictColors.border,
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
            <View
              style={[
                styles.statusCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
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

            {result.activationStatus && (
              <View
                style={[
                  styles.statusCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.statusIcon,
                    { backgroundColor: withAlpha(BRAND.primary, 0.1) },
                  ]}
                >
                  <Ionicons name="sparkles" size={20} color={BRAND.primary} />
                </View>
                <View style={styles.statusInfo}>
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Activation Status
                  </Text>
                  <Text style={[styles.statusValue, { color: colors.text }]}>
                    {result.activationStatus}
                  </Text>
                </View>
              </View>
            )}

            {/* iCloud Lock */}
            <View
              style={[
                styles.statusCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
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
            <View
              style={[
                styles.statusCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
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
            <View
              style={[
                styles.statusCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
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
          <Pressable
            style={[
              styles.resetButton,
              {
                backgroundColor: withAlpha(BRAND.primary, 0.06),
                borderColor: withAlpha(BRAND.primary, 0.18),
              },
            ]}
            onPress={handleReset}
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Section */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.heroHeader}>
              <View
                style={[
                  styles.heroIcon,
                  { backgroundColor: withAlpha(BRAND.primary, 0.1) },
                ]}
              >
                <Ionicons
                  name="barcode-outline"
                  size={24}
                  color={BRAND.primary}
                />
              </View>
              <View style={styles.heroCopy}>
                <Text
                  style={[styles.heroEyebrow, { color: BRAND.primary }]}
                  numberOfLines={1}
                >
                  Device verification
                </Text>
                <Text style={[styles.heroTitle, { color: colors.text }]}>
                  IMEI Checker
                </Text>
              </View>
            </View>

            <Text
              style={[styles.heroSubtitle, { color: colors.textSecondary }]}
            >
              Check blacklist, iCloud and SIM lock status before you pay.
            </Text>

            <View style={styles.trustIndicators}>
              {['15-digit check', 'Official status', 'Instant report'].map(
                (item) => (
                  <View
                    key={item}
                    style={[
                      styles.trustPill,
                      { backgroundColor: withAlpha(BRAND.primary, 0.06) },
                    ]}
                  >
                    <Ionicons name="checkmark" size={12} color="#059669" />
                    <Text
                      style={[
                        styles.trustText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item}
                    </Text>
                  </View>
                )
              )}
            </View>
          </View>

          {/* Service Tier Selection */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Report type
            </Text>
            <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
              {currentTier.name} - {formatServicePrice(currentTier.price)}
            </Text>
          </View>

          <View style={styles.brandFilterRow}>
            {BRAND_FILTERS.map((brand) => {
              const isSelected = selectedBrand === brand.id;

              return (
                <Pressable
                  key={brand.id}
                  style={[
                    styles.brandFilterChip,
                    {
                      backgroundColor: isSelected
                        ? withAlpha(BRAND.primary, 0.1)
                        : colors.card,
                      borderColor: isSelected ? BRAND.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleBrandSelect(brand.id)}
                >
                  <Text
                    style={[
                      styles.brandFilterText,
                      {
                        color: isSelected ? BRAND.primary : colors.text,
                      },
                    ]}
                  >
                    {brand.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.tierGrid}>
            {displayedServiceTiers.map((tierKey) => {
              const tier = SERVICE_TIERS[tierKey];
              const isSelected = selectedTier === tierKey;

              return (
                <Pressable
                  key={tierKey}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: isSelected
                        ? withAlpha(BRAND.primary, 0.08)
                        : colors.card,
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
                    {formatServicePrice(tier.price)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[
              styles.expandServicesButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={handleToggleServices}
          >
            <Text style={[styles.expandServicesText, { color: colors.text }]}>
              {showAllServices ? 'Show key checks' : 'Show all services'}
            </Text>
            <Ionicons
              name={showAllServices ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </Pressable>

          {/* Features */}
          <View
            style={[
              styles.featuresContainer,
              {
                backgroundColor: withAlpha(BRAND.primary, 0.04),
                borderColor: withAlpha(BRAND.primary, 0.12),
              },
            ]}
          >
            <Text style={[styles.featuresLabel, { color: colors.text }]}>
              Included in {currentTier.name}
            </Text>
            <Text
              style={[styles.featuresDetail, { color: colors.textSecondary }]}
            >
              {currentTier.detail}
            </Text>
            <View style={styles.featuresList}>
              {currentTier.features.map((feature) => (
                <View
                  key={feature}
                  style={[
                    styles.featureTag,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
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
          <View
            style={[
              styles.inputCard,
              {
                backgroundColor: colors.card,
                borderColor: imei.length === 15 ? BRAND.primary : colors.border,
              },
            ]}
          >
            <View style={styles.inputHeader}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Enter 15-digit IMEI
              </Text>
              <Text
                style={[
                  styles.imeiCount,
                  {
                    color:
                      imei.length === 15 ? BRAND.primary : colors.textSecondary,
                  },
                ]}
              >
                {imei.length}/15 digits
              </Text>
            </View>
            <View style={styles.inputWrapper}>
              <View
                style={[
                  styles.inputIcon,
                  { backgroundColor: withAlpha(BRAND.primary, 0.1) },
                ]}
              >
                <Ionicons
                  name="barcode-outline"
                  size={18}
                  color={BRAND.primary}
                />
              </View>
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

            <View
              style={[
                styles.inputProgressTrack,
                { backgroundColor: withAlpha(BRAND.primary, 0.1) },
              ]}
            >
              <View
                style={[
                  styles.inputProgressFill,
                  {
                    backgroundColor: BRAND.primary,
                    width: `${(imei.length / 15) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* How to Find IMEI */}
          <View
            style={[
              styles.helpCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.helpHeader}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={BRAND.primary}
              />
              <Text style={[styles.helpTitle, { color: colors.text }]}>
                How to find your IMEI
              </Text>
            </View>
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
                  Verify Now - {formatServicePrice(currentTier.price)}
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
    padding: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 100,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: RADIUS['2xl'],
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    lineHeight: 30,
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: SPACING.md,
  },
  trustIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  trustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  trustText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  sectionMeta: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  brandFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  brandFilterChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  brandFilterText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tierCard: {
    width: '48.8%',
    minHeight: 124,
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    justifyContent: 'space-between',
  },
  expandServicesButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  expandServicesText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
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
    fontFamily: 'Inter_700Bold',
    marginTop: SPACING.xs,
  },
  tierTagline: {
    fontSize: 10,
    marginTop: 2,
  },
  tierPrice: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginTop: SPACING.xs,
  },
  featuresContainer: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  featuresLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  featuresDetail: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  featureText: {
    fontSize: 11,
  },
  inputCard: {
    borderWidth: 1.5,
    borderRadius: RADIUS['2xl'],
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
  },
  inputIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  imeiInput: {
    flex: 1,
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  imeiCount: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  inputProgressTrack: {
    height: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  inputProgressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
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
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  helpTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
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
    padding: SPACING.md,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    marginBottom: SPACING.md,
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
    borderWidth: 1,
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
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
