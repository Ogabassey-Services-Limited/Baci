/**
 * Swap/Trade-in Screen
 * Trade in old devices for credit toward new purchases
 * Features AI-powered device valuation
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let ImagePicker: typeof import('expo-image-picker') | null = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    ImagePicker = await import('expo-image-picker');
  } catch (e) {
    console.debug(
      '[SwapScreen] ImagePicker module ignored or failed to load:',
      e
    );
  }
};

loadNativeModules();

import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import {
  type AIAnalysisResult,
  AIGradeDeviceApiResponseSchema,
  parseApiResponse,
} from '@/lib/validation';

const log = createLogger('Swap');

// Using AIAnalysisResult type from validation.ts

const ELIGIBLE_DEVICES = [
  'iPhones (11 and newer)',
  'Samsung Galaxy S Series',
  'MacBooks (2018+)',
  'PlayStation 4 & 5',
  'iPads',
];

const HOW_IT_WORKS = [
  {
    title: 'Record Video',
    desc: 'Quick 10s video showing screen and body',
    icon: 'videocam-outline' as const,
  },
  {
    title: 'AI Analysis',
    desc: 'Gemini grades condition automatically',
    icon: 'sparkles-outline' as const,
  },
  {
    title: 'Get Paid',
    desc: 'Accept offer and swap instantly',
    icon: 'cash-outline' as const,
  },
];

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ogabassey.com';
const SUPPORT_PHONE = '2348146978921';

export default function SwapScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'analyzing' | 'result'>('upload');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickVideo = async () => {
    if (!ImagePicker) {
      Alert.alert(
        'Not Supported',
        'Video selection is not supported on this platform.'
      );
      return;
    }
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your media library.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        quality: 0.8,
        videoMaxDuration: 15,
      });

      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
        setError(null);
      }
    } catch (err) {
      log.error('Error picking video:', err);
      setError('Failed to select video. Please try again.');
    }
  };

  const recordVideo = async () => {
    if (!ImagePicker) {
      Alert.alert(
        'Not Supported',
        'Video recording is not supported on this platform.'
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        quality: 0.8,
        videoMaxDuration: 15,
      });

      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
        setError(null);
      }
    } catch (err) {
      log.error('Error recording video:', err);
      setError('Failed to record video. Please try again.');
    }
  };

  const startAnalysis = async () => {
    if (!videoUri) return;

    setStep('analyzing');
    setError(null);

    try {
      // Create form data
      // 2026 Note: React Native FormData accepts { uri, type, name } objects
      // This is a RN-specific API that differs from web FormData
      const formData = new FormData();
      const videoFile = {
        uri: videoUri,
        type: 'video/mp4',
        name: 'device-video.mp4',
      };
      // @ts-expect-error - React Native FormData accepts file-like objects with uri
      formData.append('video', videoFile);

      const response = await fetch(`${API_BASE_URL}/api/ai/grade-device`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const rawData = await response.json();

      if (!response.ok) {
        throw new Error(rawData?.error || 'Failed to analyze device');
      }

      // 2026 Best Practice: Validate API response with Zod
      const validated = parseApiResponse(
        AIGradeDeviceApiResponseSchema,
        rawData,
        'AI grade device API'
      );

      // Use validated data if available, otherwise fallback
      const resultData = validated?.data || rawData?.data;
      if (!resultData) {
        throw new Error('Invalid response from AI analysis');
      }

      setResult(resultData);
      setStep('result');
    } catch (err) {
      log.error('Analysis error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Analysis failed. Please try again.'
      );
      setStep('upload');
    }
  };

  const handleAcceptOffer = () => {
    if (!result) return;

    const message = encodeURIComponent(
      `Hello! I did an AI trade-in check.\n\n` +
        `Device: ${result.model}\n` +
        `Grade: ${result.grade}\n` +
        `Estimate: N${result.estimatedValue.toLocaleString()}\n` +
        `Observations: ${result.observations.join(', ')}\n\n` +
        `I'd like to proceed with the swap.`
    );

    Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=${message}`);
    setIsModalOpen(false);
  };

  const resetModal = () => {
    setStep('upload');
    setVideoUri(null);
    setResult(null);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'Excellent':
        return '#059669';
      case 'Good':
        return '#2563EB';
      case 'Fair':
        return '#D97706';
      default:
        return '#DC2626';
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          title: 'Swap & Trade-in',
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
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="swap-horizontal" size={28} color={BRAND.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Swap & Trade-in
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: colors.textSecondary }]}
            >
              Upgrade to the latest tech for less
            </Text>
          </View>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#FFF" />
            <Text style={styles.heroBadgeText}>Powered by Gemini AI</Text>
          </View>
          <Text style={styles.heroTitle}>
            Get an Instant AI{'\n'}Valuation in Seconds
          </Text>
          <Text style={styles.heroSubtitle}>
            Upload a short video of your device. Our AI will analyze the
            condition and give you an instant trade-in offer.
          </Text>
          <Pressable
            style={styles.heroButton}
            onPress={() => setIsModalOpen(true)}
          >
            <Text style={styles.heroButtonText}>Start AI Trade-in</Text>
            <Ionicons name="camera" size={18} color={BRAND.primary} />
          </Pressable>
        </View>

        {/* How It Works */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          How it Works
        </Text>
        <View style={styles.stepsContainer}>
          {HOW_IT_WORKS.map((step, index) => (
            <View
              key={index}
              style={[styles.stepCard, { backgroundColor: colors.card }]}
            >
              <View style={styles.stepIconContainer}>
                <Ionicons name={step.icon} size={24} color={BRAND.primary} />
              </View>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                {index + 1}. {step.title}
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                {step.desc}
              </Text>
            </View>
          ))}
        </View>

        {/* Eligible Devices */}
        <View style={[styles.eligibleCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.eligibleTitle, { color: colors.text }]}>
            What can you trade in?
          </Text>
          {ELIGIBLE_DEVICES.map((device, index) => (
            <View key={index} style={styles.eligibleItem}>
              <View style={styles.eligibleCheck}>
                <Ionicons name="checkmark" size={14} color="#059669" />
              </View>
              <Text style={[styles.eligibleText, { color: colors.text }]}>
                {device}
              </Text>
            </View>
          ))}
        </View>

        {/* Sustainability Section */}
        <View style={styles.sustainabilityCard}>
          <View style={styles.sustainabilityIcon}>
            <Ionicons name="leaf" size={32} color="#059669" />
          </View>
          <View style={styles.sustainabilityContent}>
            <View style={styles.sustainabilityHeader}>
              <Ionicons name="sync" size={18} color="#059669" />
              <Text style={styles.sustainabilityTitle}>
                Trade-in is Recycling
              </Text>
            </View>
            <Text style={styles.sustainabilityText}>
              By swapping your device, you keep e-waste out of landfills. We
              refurbish and re-home your old gadgets, extending their lifecycle.
              It's a win for your wallet and the planet.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Trade-in Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Modal Header */}
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <View style={styles.modalHeaderTitle}>
                <Ionicons name="sparkles" size={20} color={BRAND.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  AI Trade-in Valuator
                </Text>
              </View>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Modal Body */}
            <View style={styles.modalBody}>
              {step === 'upload' && (
                <>
                  <View
                    style={[styles.uploadArea, { borderColor: colors.border }]}
                  >
                    <View style={styles.uploadIconContainer}>
                      <Ionicons
                        name="videocam"
                        size={32}
                        color={BRAND.primary}
                      />
                    </View>
                    <Text style={[styles.uploadTitle, { color: colors.text }]}>
                      Upload a Video of Your Device
                    </Text>
                    <Text
                      style={[
                        styles.uploadDesc,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Show the screen and back clearly. Keep it under 15
                      seconds.
                    </Text>

                    {videoUri ? (
                      <View style={styles.videoSelected}>
                        <View style={styles.videoSelectedBadge}>
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color="#059669"
                          />
                          <Text style={styles.videoSelectedText}>
                            Video Selected
                          </Text>
                        </View>
                        <Pressable onPress={() => setVideoUri(null)}>
                          <Text style={styles.removeVideoText}>Remove</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.uploadButtons}>
                        <Pressable
                          style={[
                            styles.uploadButton,
                            { backgroundColor: BRAND.primary },
                          ]}
                          onPress={pickVideo}
                        >
                          <Ionicons name="folder" size={18} color="#FFF" />
                          <Text style={styles.uploadButtonText}>
                            Select Video
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.uploadButton,
                            { backgroundColor: colors.text },
                          ]}
                          onPress={recordVideo}
                        >
                          <Ionicons name="camera" size={18} color="#FFF" />
                          <Text style={styles.uploadButtonText}>
                            Record Now
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {error && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <Pressable
                    style={[
                      styles.analyzeButton,
                      { backgroundColor: BRAND.primary },
                      !videoUri && styles.analyzeButtonDisabled,
                    ]}
                    onPress={startAnalysis}
                    disabled={!videoUri}
                  >
                    <Text style={styles.analyzeButtonText}>Analyze Device</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                  </Pressable>
                </>
              )}

              {step === 'analyzing' && (
                <View style={styles.analyzingContainer}>
                  <View style={styles.analyzingSpinner}>
                    <ActivityIndicator size="large" color={BRAND.primary} />
                    <View style={styles.sparkleIcon}>
                      <Ionicons
                        name="sparkles"
                        size={24}
                        color={BRAND.primary}
                      />
                    </View>
                  </View>
                  <Text style={[styles.analyzingTitle, { color: colors.text }]}>
                    Gemini AI is Analyzing...
                  </Text>
                  <Text
                    style={[
                      styles.analyzingDesc,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Checking screen condition... Identifying model...
                  </Text>
                </View>
              )}

              {step === 'result' && result && (
                <>
                  {/* Value Display */}
                  <View style={styles.valueCard}>
                    <Text style={styles.valueLabel}>
                      Estimated Trade-in Value
                    </Text>
                    <Text style={styles.valueAmount}>
                      N{result.estimatedValue.toLocaleString()}
                    </Text>
                    {result.basePrice > 0 && (
                      <Text style={styles.valueBase}>
                        Based on market price: N
                        {result.basePrice.toLocaleString()}
                      </Text>
                    )}
                  </View>

                  {/* Details Grid */}
                  <View style={styles.detailsGrid}>
                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: colors.card },
                      ]}
                    >
                      <Text
                        style={[
                          styles.detailLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Model
                      </Text>
                      <Text
                        style={[styles.detailValue, { color: colors.text }]}
                      >
                        {result.model}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: colors.card },
                      ]}
                    >
                      <Text
                        style={[
                          styles.detailLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Condition
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: getGradeColor(result.grade) },
                        ]}
                      >
                        {result.grade}
                      </Text>
                    </View>
                  </View>

                  {/* Observations */}
                  <View
                    style={[
                      styles.observationsCard,
                      { backgroundColor: colors.card },
                    ]}
                  >
                    <Text
                      style={[styles.observationsTitle, { color: colors.text }]}
                    >
                      AI Observations:
                    </Text>
                    {result.observations.map((obs, i) => (
                      <Text
                        key={i}
                        style={[
                          styles.observationItem,
                          { color: colors.textSecondary },
                        ]}
                      >
                        • {obs}
                      </Text>
                    ))}
                    <Text
                      style={[
                        styles.observationNote,
                        { color: colors.textSecondary },
                      ]}
                    >
                      *Final verification required in-store.
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <Pressable
                    style={styles.acceptButton}
                    onPress={handleAcceptOffer}
                  >
                    <Text style={styles.acceptButtonText}>
                      Accept Offer & Chat
                    </Text>
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                  </Pressable>

                  <Pressable style={styles.retryButton} onPress={resetModal}>
                    <Text
                      style={[
                        styles.retryButtonText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Try Another Device
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: BRAND.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: SPACING.md,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  heroButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  heroButtonText: {
    color: BRAND.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  stepsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  stepCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  stepIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  eligibleCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  eligibleTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  eligibleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  eligibleCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DEF7EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eligibleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sustainabilityCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  sustainabilityIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sustainabilityContent: {
    flex: 1,
  },
  sustainabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  sustainabilityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },
  sustainabilityText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#047857',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    padding: SPACING.lg,
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  uploadIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  uploadDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  videoSelected: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  videoSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DEF7EC',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
  },
  videoSelectedText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
  },
  removeVideoText: {
    color: '#DC2626',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  analyzingSpinner: {
    position: 'relative',
    width: 80,
    height: 80,
    marginBottom: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleIcon: {
    position: 'absolute',
  },
  analyzingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  analyzingDesc: {
    fontSize: 14,
  },
  valueCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  valueLabel: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  valueAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#059669',
  },
  valueBase: {
    fontSize: 11,
    color: '#10B981',
    marginTop: SPACING.xs,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  observationsCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  observationsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  observationItem: {
    fontSize: 13,
    lineHeight: 22,
  },
  observationNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  acceptButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    fontSize: 14,
  },
});
