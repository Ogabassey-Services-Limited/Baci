import { normalizeCacSearchTerm, parseCacRegistration } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { apiClient, apiFormData, NetworkError } from '@/lib/api-client';
import { createUploadFile } from '@/types/upload';
import CacResultStep from './CacResultStep';
import CacSearchStep from './CacSearchStep';
import CacUploadStep from './CacUploadStep';
import {
  chooseCertificateSource,
  pickCertificateFromFiles,
  pickCertificateFromGallery,
} from './cac-certificate-picker';
import {
  type CacCompany,
  type CacRegistrationPrefix,
  type CacStep,
  normalizeCacStatus,
  type SelectedCacDocument,
} from './cac-types';
import VerificationStatusBadge from './VerificationStatusBadge';

interface CacVerificationCardProps {
  cacApprovedName?: string | null;
  onVerified: () => void;
  prefillRcNumber?: string | null;
  verified: boolean;
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
  const [registrationPrefix, setRegistrationPrefix] =
    useState<CacRegistrationPrefix>('RC');
  const [rcNumber, setRcNumber] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<CacCompany | null>(
    null
  );
  const [selectedDocument, setSelectedDocument] =
    useState<SelectedCacDocument | null>(null);
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    const parsedRegistration = parseCacRegistration(prefillRcNumber);

    if (parsedRegistration?.prefix) {
      setRegistrationPrefix(parsedRegistration.prefix as CacRegistrationPrefix);
      setRcNumber(parsedRegistration.digits);
    } else {
      setRcNumber(parsedRegistration?.digits ?? '');
    }
  }, [prefillRcNumber]);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient<{
        companies: Array<{
          approvedName: string;
          rcNumber: string;
          status: unknown;
        }>;
      }>('/api/merchant/cac-search', {
        method: 'POST',
        body: JSON.stringify({
          searchTerm: normalizeCacSearchTerm(rcNumber, registrationPrefix),
        }),
      });
      const companies: CacCompany[] = response.companies.map((c) => ({
        approvedName: c.approvedName,
        rcNumber: c.rcNumber,
        status: normalizeCacStatus(c.status),
      }));
      return { companies };
    },
    onSuccess: ({ companies }) => {
      if (companies.length === 1) {
        setSelectedCompany(companies[0]);
        setCacStep('upload');
      } else {
        setSelectedCompany(null);
        setCacStep('search');
      }
    },
    onError: (error: unknown) => handleMutationError(error),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedCompany) {
        throw new Error('Missing selected company for upload.');
      }
      if (!selectedDocument) {
        throw new Error('Missing certificate file for upload.');
      }
      const formData = new FormData();
      const subtype = selectedDocument.mimeType.split('/')[1] || 'jpeg';
      const ext = subtype === 'jpeg' ? 'jpg' : subtype;
      formData.append(
        'file',
        createUploadFile({
          uri: selectedDocument.uri,
          name: selectedDocument.name || `cac-certificate.${ext}`,
          type: selectedDocument.mimeType,
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
    setCacStep('upload');
  }

  async function handlePickDocument() {
    try {
      const source = await chooseCertificateSource();
      if (!source) return;
      const document =
        source === 'gallery'
          ? await pickCertificateFromGallery()
          : await pickCertificateFromFiles();

      if (document) {
        setSelectedDocument(document);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to access your selected certificate source. Please try again.';
      Alert.alert('Error', message);
    }
  }

  function handleTryAgain() {
    setVerifyResult(null);
    setSelectedCompany(null);
    setSelectedDocument(null);
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
              registrationPrefix={registrationPrefix}
              onChangeRegistrationPrefix={setRegistrationPrefix}
              rcNumber={rcNumber}
              onChangeRcNumber={setRcNumber}
              onSearch={handleSearch}
              isSearching={searchMutation.isPending}
              results={searchMutation.data?.companies}
              onSelect={handleSelectCompany}
            />
          )}
          {cacStep === 'upload' && selectedCompany && (
            <CacUploadStep
              company={selectedCompany}
              document={selectedDocument}
              onBack={() => {
                setSelectedDocument(null);
                setCacStep('search');
              }}
              onPickDocument={handlePickDocument}
              onVerify={() => {
                if (selectedDocument) uploadMutation.mutate();
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
