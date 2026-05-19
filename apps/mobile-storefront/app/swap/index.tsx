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
// Bug #M21: Store the loading promise so we can await it before using ImagePicker,
// preventing race conditions if the user taps before the module loads.
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

// Bug #M21: Store the promise so pickVideo/recordVideo can await it,
// preventing race condition if user taps before module loads.
const _imagePickerReady = loadNativeModules();

import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { SUPPORT_WHATSAPP_PHONE } from '@/constants/Support';
import { fetchWithTimeout, LONG_TIMEOUT } from '@/lib/fetch-with-timeout';
import { createLogger } from '@/lib/logger';
import {
  buildSwapWhatsappUrl,
  getSwapGradeColor,
  SWAP_ELIGIBLE_DEVICES,
  SWAP_HOW_IT_WORKS,
} from '@/lib/swap-utils';
import {
  type AIAnalysisResult,
  AIGradeDeviceApiResponseSchema,
  parseApiResponse,
} from '@/lib/validation';

const log = createLogger('Swap');

// Using AIAnalysisResult type from validation.ts

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ogabassey.com';

export default function SwapScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'analyzing' | 'result'>('upload');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const pickVideo = async () => {
    // Bug #M21: Await module load to prevent race condition
    await _imagePickerReady;
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
    // Bug #M21: Await module load to prevent race condition
    await _imagePickerReady;
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
    if (!videoUri || isAnalyzing) return;
    setIsAnalyzing(true);

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
      } as unknown as Blob;
      formData.append('video', videoFile);

      // Bug #H20: Do NOT set Content-Type manually for multipart/form-data.
      // Let fetch auto-set it with the correct boundary parameter.
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/ai/grade-device`,
        {
          method: 'POST',
          body: formData,
          timeout: LONG_TIMEOUT,
        }
      );

      if (!response.ok) {
        let errorMsg = `Server error (HTTP ${response.status})`;
        try {
          const errData = await response.json();
          if (errData?.error) errorMsg = errData.error;
        } catch {
          /* non-JSON response */
        }
        throw new Error(errorMsg);
      }

      const rawData = await response.json();

      // Bug #68: Validate AI response with Zod; do NOT fall back to unvalidated data
      const validated = parseApiResponse(
        AIGradeDeviceApiResponseSchema,
        rawData,
        'AI grade device API'
      );

      if (!validated || !validated.data) {
        throw new Error(
          'We could not process the AI analysis result. Please try again.'
        );
      }

      setResult(validated.data);
      setStep('result');
    } catch (err) {
      log.error('Analysis error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Analysis failed. Please try again.'
      );
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAcceptOffer = () => {
    if (!result) return;
    Linking.openURL(buildSwapWhatsappUrl(result, SUPPORT_WHATSAPP_PHONE));
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
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
            <Ionicons name="sparkles" size={12} color={colors.white} />
            <Text style={[styles.heroBadgeText, { color: colors.white }]}>Powered by Gemini AI</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.white }]}>
            Get an Instant AI{'\n'}Valuation in Seconds
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.white }]}>
            Upload a short video of your device. Our AI will analyze the
            condition and give you an instant trade-in offer.
          </Text>
          <Pressable
            style={[styles.heroButton, { backgroundColor: colors.white }]}
            onPress={() => setIsModalOpen(true)}
          >
            <Text style={[styles.heroButtonText, { color: BRAND.primary }]}>Start AI Trade-in</Text>
            <Ionicons name="camera" size={18} color={BRAND.primary} />
          </Pressable>
        </View>

        {/* How It Works */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          How it Works
        </Text>
        <View style={styles.stepsContainer}>
          {SWAP_HOW_IT_WORKS.map((step, index) => (
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
          {SWAP_ELIGIBLE_DEVICES.map((device, index) => (
            <View key={index} style={styles.eligibleItem}>
              <View style={[styles.eligibleCheck, { backgroundColor: colors.muted }]}>
                <Ionicons name="checkmark" size={14} color={colors.success} />
              </View>
              <Text style={[styles.eligibleText, { color: colors.text }]}>
                {device}
              </Text>
            </View>
          ))}
        </View>

        {/* Sustainability Section */}
        <View style={[styles.sustainabilityCard, { backgroundColor: colors.muted }]}>
          <View style={[styles.sustainabilityIcon, { backgroundColor: colors.background }]}>
            <Ionicons name="leaf" size={32} color={colors.success} />
          </View>
          <View style={styles.sustainabilityContent}>
            <View style={styles.sustainabilityHeader}>
              <Ionicons name="sync" size={18} color={colors.success} />
              <Text style={[styles.sustainabilityTitle, { color: colors.success }]}>
                Trade-in is Recycling
              </Text>
            </View>
            <Text style={[styles.sustainabilityText, { color: colors.textSecondary }]}>
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
                    <View style={[styles.uploadIconContainer, { backgroundColor: colors.background }]}>
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
                        <View style={[styles.videoSelectedBadge, { backgroundColor: colors.muted }]}>
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={colors.success}
                          />
                          <Text style={[styles.videoSelectedText, { color: colors.success }]}>
                            Video Selected
                          </Text>
                        </View>
                        <Pressable onPress={() => setVideoUri(null)}>
                          <Text style={[styles.removeVideoText, { color: colors.error }]}>Remove</Text>
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
                          <Ionicons name="folder" size={18} color={colors.white} />
                          <Text style={[styles.uploadButtonText, { color: colors.white }]}>
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
                          <Ionicons name="camera" size={18} color={colors.white} />
                          <Text style={[styles.uploadButtonText, { color: colors.white }]}>
                            Record Now
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {error && (
                    <View style={[styles.errorContainer, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                    </View>
                  )}

                  <Pressable
                    style={[
                      styles.analyzeButton,
                      { backgroundColor: BRAND.primary },
                      (!videoUri || isAnalyzing) &&
                        styles.analyzeButtonDisabled,
                    ]}
                    onPress={startAnalysis}
                    disabled={!videoUri || isAnalyzing}
                  >
                    <Text style={[styles.analyzeButtonText, { color: colors.white }]}>Analyze Device</Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.white} />
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
                  <View style={[styles.valueCard, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.valueLabel, { color: colors.success }]}>
                      Estimated Trade-in Value
                    </Text>
                    <Text style={[styles.valueAmount, { color: colors.success }]}>
                      N{result.estimatedValue.toLocaleString()}
                    </Text>
                    {result.basePrice > 0 && (
                      <Text style={[styles.valueBase, { color: colors.success }]}>
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
                          { color: getSwapGradeColor(result.grade, colors) },
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
                    style={[styles.acceptButton, { backgroundColor: colors.success }]}
                    onPress={handleAcceptOffer}
                  >
                    <Text style={[styles.acceptButtonText, { color: colors.white }]}>
                      Accept Offer & Chat
                    </Text>
                    <Ionicons name="checkmark" size={20} color={colors.white} />
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
    paddingHorizontal: SPACING.md,
    marginTop: 0, // Snapped to top for ultra-tight feel
    marginBottom: SPACING.md, // Balanced spacing
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
    backgroundColor: 'rgba(255,255,255,0.2)', // maintained alpha for transparency over red
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: SPACING.md,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    opacity: 0.8,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  heroButtonText: {
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  eligibleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sustainabilityCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  sustainabilityIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  },
  sustainabilityText: {
    fontSize: 12,
    lineHeight: 18,
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
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
  },
  videoSelectedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeVideoText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  errorText: {
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
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  valueLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  valueAmount: {
    fontSize: 32,
    fontWeight: '800',
  },
  valueBase: {
    fontSize: 11,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  acceptButtonText: {
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
