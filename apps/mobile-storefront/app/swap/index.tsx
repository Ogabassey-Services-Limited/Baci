/**
 * Swap/Trade-in Screen
 * Trade in old devices for credit toward new purchases
 * Features AI-powered device valuation
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SwapOverviewContent } from '@/components/swap/SwapOverviewContent';
import {
  SwapTradeInModal,
  type SwapModalStep,
} from '@/components/swap/SwapTradeInModal';
import { swapScreenStyles as styles } from '@/components/swap/swap-screen.styles';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SUPPORT_WHATSAPP_PHONE } from '@/constants/Support';
import { fetchWithTimeout, LONG_TIMEOUT } from '@/lib/fetch-with-timeout';
import { createLogger } from '@/lib/logger';
import { buildSwapWhatsappUrl } from '@/lib/swap-utils';
import {
  type AIAnalysisResult,
  AIGradeDeviceApiResponseSchema,
  parseApiResponse,
} from '@/lib/validation';

let ImagePicker: typeof import('expo-image-picker') | null = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    ImagePicker = await import('expo-image-picker');
  } catch (error) {
    console.debug('[SwapScreen] ImagePicker module load failed:', error);
  }
};

const imagePickerReady = loadNativeModules();

const log = createLogger('Swap');
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ogabassey.com';

export default function SwapScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<SwapModalStep>('upload');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const pickVideo = async () => {
    await imagePickerReady;
    if (!ImagePicker) {
      Alert.alert(
        'Not Supported',
        'Video selection is not supported on this platform.'
      );
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your media library.'
        );
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        quality: 0.8,
        videoMaxDuration: 15,
      });

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setVideoUri(pickerResult.assets[0].uri);
        setError(null);
      }
    } catch (pickerError) {
      log.error('Error picking video:', pickerError);
      setError('Failed to select video. Please try again.');
    }
  };

  const recordVideo = async () => {
    await imagePickerReady;
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

      const cameraResult = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        quality: 0.8,
        videoMaxDuration: 15,
      });

      if (!cameraResult.canceled && cameraResult.assets[0]) {
        setVideoUri(cameraResult.assets[0].uri);
        setError(null);
      }
    } catch (cameraError) {
      log.error('Error recording video:', cameraError);
      setError('Failed to record video. Please try again.');
    }
  };

  const startAnalysis = async () => {
    if (!videoUri || isAnalyzing) return;

    setIsAnalyzing(true);
    setStep('analyzing');
    setError(null);

    try {
      const formData = new FormData();
      const videoFile = {
        uri: videoUri,
        type: 'video/mp4',
        name: 'device-video.mp4',
      } as unknown as Blob;
      formData.append('video', videoFile);

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/ai/grade-device`,
        {
          method: 'POST',
          body: formData,
          timeout: LONG_TIMEOUT,
        }
      );

      if (!response.ok) {
        let errorMessage = `Server error (HTTP ${response.status})`;
        try {
          const errorPayload = await response.json();
          if (errorPayload?.error) {
            errorMessage = errorPayload.error;
          }
        } catch {
          // ignore non-JSON error bodies
        }
        throw new Error(errorMessage);
      }

      const rawPayload = await response.json();
      const validated = parseApiResponse(
        AIGradeDeviceApiResponseSchema,
        rawPayload,
        'AI grade device API'
      );

      if (!validated?.data) {
        throw new Error(
          'We could not process the AI analysis result. Please try again.'
        );
      }

      setResult(validated.data);
      setStep('result');
    } catch (analysisError) {
      log.error('Analysis error:', analysisError);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : 'Analysis failed. Please try again.'
      );
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
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

  const handleAcceptOffer = () => {
    if (!result) return;
    Linking.openURL(buildSwapWhatsappUrl(result, SUPPORT_WHATSAPP_PHONE));
    setIsModalOpen(false);
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
        <SwapOverviewContent
          colors={colors}
          onStartTradeIn={() => setIsModalOpen(true)}
        />
      </ScrollView>

      <SwapTradeInModal
        colors={colors}
        error={error}
        isAnalyzing={isAnalyzing}
        result={result}
        step={step}
        videoUri={videoUri}
        visible={isModalOpen}
        onAcceptOffer={handleAcceptOffer}
        onClearVideo={() => setVideoUri(null)}
        onClose={closeModal}
        onPickVideo={pickVideo}
        onRecordVideo={recordVideo}
        onReset={resetModal}
        onStartAnalysis={startAnalysis}
      />
    </SafeAreaView>
  );
}
