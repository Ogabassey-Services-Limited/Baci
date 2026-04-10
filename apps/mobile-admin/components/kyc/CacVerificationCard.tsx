import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { apiClient, apiFormData, NetworkError } from '@/lib/api-client';
import { createUploadFile } from '@/types/upload';
import CacConfirmStep from './CacConfirmStep';
import CacResultStep from './CacResultStep';
import CacSearchStep from './CacSearchStep';
import CacUploadStep from './CacUploadStep';
import type { CacCompany, CacStep } from './cac-types';
import VerificationStatusBadge from './VerificationStatusBadge';

interface CacVerificationCardProps {
  verified: boolean;
  prefillRcNumber?: string | null;
  cacApprovedName?: string | null;
  onVerified: () => void;
}

export default function CacVerificationCard({
  verified,
  prefillRcNumber,
  cacApprovedName,
  onVerified,
}: CacVerificationCardProps) {
  const { colors, shadows } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [cacStep, setCacStep] = useState<CacStep>('search');
  const [rcNumber, setRcNumber] = useState(prefillRcNumber ?? '');
  const [selectedCompany, setSelectedCompany] = useState<CacCompany | null>(
    null
  );

  useEffect(() => {
    setRcNumber(prefillRcNumber ?? '');
  }, [prefillRcNumber]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    reason?: string;
  } | null>(null);

  const searchMutation = useMutation({
    mutationFn: () =>
      apiClient<{ companies: CacCompany[] }>('/api/merchant/cac-search', {
        method: 'POST',
        body: JSON.stringify({ searchTerm: rcNumber.trim() }),
      }),
    onError: (error: unknown) => handleMutationError(error),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedCompany || !imageUri) throw new Error('Missing data');
      const formData = new FormData();
      const subtype = imageMimeType.split('/')[1] || 'jpeg';
      const ext = subtype === 'jpeg' ? 'jpg' : subtype;
      formData.append(
        'file',
        createUploadFile({
          uri: imageUri,
          name: `cac-certificate.${ext}`,
          type: imageMimeType,
        }) as unknown as Blob
      );
      formData.append('rcNumber', selectedCompany.rcNumber);
      formData.append('approvedName', selectedCompany.approvedName);
      return apiFormData<{ verified: boolean; reason?: string }>(
        '/api/merchant/verify-cac',
        formData
      );
    },
    onSuccess: (data) => {
      setVerifyResult(data);
      setCacStep('result');
      if (data.verified) onVerified();
    },
    onError: (error: unknown) => handleMutationError(error),
  });

  function handleMutationError(error: unknown) {
    if (error instanceof NetworkError && error.statusCode === 429) {
      Alert.alert(
        'Rate Limited',
        'Rate limit exceeded. Please wait a minute and try again.'
      );
      return;
    }
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    Alert.alert('Error', message);
  }

  function handleSearch() {
    if (!rcNumber.trim()) return;
    searchMutation.mutate();
  }

  function handleSelectCompany(company: CacCompany) {
    setSelectedCompany(company);
    setCacStep('confirm');
  }

  async function handlePickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (asset.mimeType) setImageMimeType(asset.mimeType);
      }
    } catch {
      Alert.alert(
        'Error',
        'Unable to access photo library. Please check your permissions.'
      );
    }
  }

  function handleTryAgain() {
    setVerifyResult(null);
    setSelectedCompany(null);
    setImageUri(null);
    setCacStep('search');
  }

  if (verified) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
          shadows.sm,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            CAC Verification
          </Text>
          <VerificationStatusBadge verified />
        </View>
        {cacApprovedName ? (
          <Text style={[styles.approvedName, { color: colors.success }]}>
            {cacApprovedName}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        shadows.sm,
      ]}
    >
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel="Toggle CAC Verification section"
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>
            CAC Verification
          </Text>
          <VerificationStatusBadge verified={false} />
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {cacStep === 'search' && (
            <CacSearchStep
              rcNumber={rcNumber}
              onChangeRcNumber={setRcNumber}
              onSearch={handleSearch}
              isSearching={searchMutation.isPending}
              results={searchMutation.data?.companies}
              onSelect={handleSelectCompany}
            />
          )}
          {cacStep === 'confirm' && selectedCompany && (
            <CacConfirmStep
              company={selectedCompany}
              onBack={() => setCacStep('search')}
              onConfirm={() => setCacStep('upload')}
            />
          )}
          {cacStep === 'upload' && (
            <CacUploadStep
              imageUri={imageUri}
              onPickImage={handlePickImage}
              onVerify={() => {
                if (imageUri) uploadMutation.mutate();
              }}
              isUploading={uploadMutation.isPending}
            />
          )}
          {cacStep === 'result' && verifyResult && (
            <CacResultStep
              verified={verifyResult.verified}
              reason={verifyResult.reason}
              onTryAgain={handleTryAgain}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  approvedName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
  },
  body: { marginTop: SPACING.lg, gap: SPACING.md },
});
