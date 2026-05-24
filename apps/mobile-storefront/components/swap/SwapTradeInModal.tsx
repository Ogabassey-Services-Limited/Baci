import Ionicons from "@react-native-vector-icons/ionicons/static";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { BRAND } from '@/constants/Colors';
import type { AIAnalysisResult } from '@/lib/validation';
import { getSwapGradeColor } from '@/lib/swap-utils';
import { swapScreenStyles as styles } from './swap-screen.styles';

type SwapColors = (typeof import('@/constants/Colors').default)['light'];

export type SwapModalStep = 'upload' | 'analyzing' | 'result';

type SwapTradeInModalProps = {
  colors: SwapColors;
  error: string | null;
  isAnalyzing: boolean;
  result: AIAnalysisResult | null;
  step: SwapModalStep;
  videoUri: string | null;
  visible: boolean;
  onAcceptOffer: () => void;
  onClose: () => void;
  onClearVideo: () => void;
  onPickVideo: () => void;
  onRecordVideo: () => void;
  onReset: () => void;
  onStartAnalysis: () => void;
};

export function SwapTradeInModal({
  colors,
  error,
  isAnalyzing,
  result,
  step,
  videoUri,
  visible,
  onAcceptOffer,
  onClose,
  onClearVideo,
  onPickVideo,
  onRecordVideo,
  onReset,
  onStartAnalysis,
}: SwapTradeInModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.modalHeaderTitle}>
              <Ionicons name="sparkles" size={20} color={BRAND.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                AI Trade-in Valuator
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            {step === 'upload' && (
              <>
                <View style={[styles.uploadArea, { borderColor: colors.border }]}>
                  <View
                    style={[
                      styles.uploadIconContainer,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Ionicons name="videocam" size={32} color={BRAND.primary} />
                  </View>
                  <Text style={[styles.uploadTitle, { color: colors.text }]}>
                    Upload a Video of Your Device
                  </Text>
                  <Text style={[styles.uploadDesc, { color: colors.textSecondary }]}>
                    Show the screen and back clearly. Keep it under 15 seconds.
                  </Text>

                  {videoUri ? (
                    <View style={styles.videoSelected}>
                      <View
                        style={[
                          styles.videoSelectedBadge,
                          { backgroundColor: colors.muted },
                        ]}
                      >
                        <Ionicons name="checkmark" size={14} color={colors.success} />
                        <Text style={[styles.videoSelectedText, { color: colors.success }]}>
                          Video Selected
                        </Text>
                      </View>
                      <Pressable onPress={onClearVideo}>
                        <Text style={[styles.removeVideoText, { color: colors.error }]}>
                          Remove
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.uploadButtons}>
                      <Pressable
                        style={[styles.uploadButton, { backgroundColor: BRAND.primary }]}
                        onPress={onPickVideo}
                      >
                        <Ionicons name="folder" size={18} color={colors.white} />
                        <Text style={[styles.uploadButtonText, { color: colors.white }]}>
                          Select Video
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.uploadButton, { backgroundColor: colors.text }]}
                        onPress={onRecordVideo}
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
                    (!videoUri || isAnalyzing) && styles.analyzeButtonDisabled,
                  ]}
                  onPress={onStartAnalysis}
                  disabled={!videoUri || isAnalyzing}
                >
                  <Text style={[styles.analyzeButtonText, { color: colors.white }]}>
                    Analyze Device
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.white} />
                </Pressable>
              </>
            )}

            {step === 'analyzing' && (
              <View style={styles.analyzingContainer}>
                <View style={styles.analyzingSpinner}>
                  <ActivityIndicator size="large" color={BRAND.primary} />
                  <View style={styles.sparkleIcon}>
                    <Ionicons name="sparkles" size={24} color={BRAND.primary} />
                  </View>
                </View>
                <Text style={[styles.analyzingTitle, { color: colors.text }]}>
                  Gemini AI is Analyzing...
                </Text>
                <Text style={[styles.analyzingDesc, { color: colors.textSecondary }]}>
                  Checking screen condition... Identifying model...
                </Text>
              </View>
            )}

            {step === 'result' && result && (
              <>
                <View style={[styles.valueCard, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.valueLabel, { color: colors.success }]}>
                    Estimated Trade-in Value
                  </Text>
                  <Text style={[styles.valueAmount, { color: colors.success }]}>
                    N{result.estimatedValue.toLocaleString()}
                  </Text>
                  {result.basePrice > 0 && (
                    <Text style={[styles.valueBase, { color: colors.success }]}>
                      Based on market price: N{result.basePrice.toLocaleString()}
                    </Text>
                  )}
                </View>

                <View style={styles.detailsGrid}>
                  <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Model
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {result.model}
                    </Text>
                  </View>
                  <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
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

                <View style={[styles.observationsCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.observationsTitle, { color: colors.text }]}>
                    AI Observations:
                  </Text>
                  {result.observations.map((observation, index) => (
                    <Text
                      key={index}
                      style={[styles.observationItem, { color: colors.textSecondary }]}
                    >
                      • {observation}
                    </Text>
                  ))}
                  <Text style={[styles.observationNote, { color: colors.textSecondary }]}>
                    *Final verification required in-store.
                  </Text>
                </View>

                <Pressable
                  style={[styles.acceptButton, { backgroundColor: colors.success }]}
                  onPress={onAcceptOffer}
                >
                  <Text style={[styles.acceptButtonText, { color: colors.white }]}>
                    Accept Offer & Chat
                  </Text>
                  <Ionicons name="checkmark" size={20} color={colors.white} />
                </Pressable>

                <Pressable style={styles.retryButton} onPress={onReset}>
                  <Text style={[styles.retryButtonText, { color: colors.textSecondary }]}>
                    Try Another Device
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
