'use client';

import { normalizeCacSearchTerm } from '@baci/shared';
import {
  Building2,
  CheckCircle2,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { validateCacCertificateFile } from './cac-file-validation';
import type { CacCompany } from './cac-ui';
import {
  AlertBanner,
  CacConfirmStep,
  normalizeCacStatus,
  StatusBadge,
} from './cac-ui';
import { CacUploadStep } from './cac-upload-step';
import { postCacVerificationRequest } from './cac-verification-request';
import { createCacVerificationFormData } from './cac-verification-upload';

interface CacVerificationProps {
  merchantId: string;
  verified: boolean;
  prefillRcNumber: string | null;
  cacApprovedName: string | null;
  onVerified: () => void;
}

type CacStep = 'search' | 'confirm' | 'upload' | 'result';

export function CacVerification({
  merchantId,
  verified,
  prefillRcNumber,
  cacApprovedName,
  onVerified,
}: CacVerificationProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cacStep, setCacStep] = useState<CacStep>('search');
  const [rcNumber, setRcNumber] = useState(prefillRcNumber ?? '');
  const [searching, setSearching] = useState(false);
  const [companies, setCompanies] = useState<CacCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CacCompany | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  if (verified) {
    return (
      <AlertBanner variant="success" icon={Building2}>
        CAC Verified{cacApprovedName ? ` — ${cacApprovedName}` : ''}
      </AlertBanner>
    );
  }

  function toastError(title: string, err: unknown) {
    toast({
      variant: 'destructive',
      title,
      description: err instanceof Error ? err.message : title,
    });
  }

  async function postApi(url: string, body: BodyInit) {
    const result = await postCacVerificationRequest(url, body);
    if (result.kind === 'rate-limited') {
      toast({
        variant: 'destructive',
        title: 'Too many requests',
        description: 'Please wait a moment and try again.',
      });
      return null;
    }
    if (result.kind === 'error') throw new Error(result.message);
    return result.data;
  }

  async function handleSearch() {
    const term = rcNumber.trim();
    if (!term) return;
    setSearching(true);
    try {
      const data = await postApi(
        '/api/merchant/cac-search',
        JSON.stringify({ searchTerm: normalizeCacSearchTerm(term) })
      );
      if (data) {
        const rawCompanies = (
          data as {
            companies: Array<{
              approvedName: string;
              rcNumber: string;
              status: unknown;
            }>;
          }
        ).companies;
        const foundCompanies: CacCompany[] = rawCompanies.map((c) => ({
          approvedName: c.approvedName,
          rcNumber: c.rcNumber,
          status: normalizeCacStatus(c.status),
        }));
        setCompanies(foundCompanies);
        if (!foundCompanies.length) {
          toast({
            title: 'No results',
            description: 'No companies found for that RC/BN number.',
          });
        }
      }
    } catch (error) {
      toastError('Search failed', error);
    }

    setSearching(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateCacCertificateFile(file);
    if (validation.kind !== 'valid') {
      toast({
        variant: 'destructive',
        title:
          validation.kind === 'invalid-type'
            ? 'Invalid file type'
            : 'File too large',
        description:
          validation.kind === 'invalid-type'
            ? 'Please upload a JPEG, PNG, WebP, or PDF file.'
            : 'Maximum file size is 5 MB.',
      });
      e.target.value = '';
      setSelectedFile(null);
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFilePreview(null);
      return;
    }
    setSelectedFile(file);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(
      file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    );
  }

  async function handleUpload() {
    if (!selectedFile || !selectedCompany) return;
    setUploading(true);
    try {
      const formData = createCacVerificationFormData({
        file: selectedFile,
        rcNumber: selectedCompany.rcNumber,
        approvedName: selectedCompany.approvedName,
        merchantId,
      });
      const data = await postApi('/api/merchant/verify-cac', formData);
      if (data) {
        const result = data as { verified: boolean; reason?: string };
        setVerifyResult(result);
        setCacStep('result');
        if (result.verified) onVerified();
      }
    } catch (error) {
      toastError('Verification failed', error);
    }

    setUploading(false);
  }

  function resetToSearch() {
    setCacStep('search');
    setSelectedCompany(null);
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setVerifyResult(null);
    setCompanies([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      {cacStep === 'search' && (
        <>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
          >
            <Input
              placeholder="Enter RC or BN number"
              value={rcNumber}
              onChange={(e) => setRcNumber(e.target.value)}
              aria-label="RC or BN number"
            />
            <Button type="submit" disabled={searching || !rcNumber.trim()}>
              {searching ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Search className="mr-2 size-4" />
              )}
              Search CAC
            </Button>
          </form>
          {companies.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {companies.length} result{companies.length !== 1 && 's'} found
              </p>
              {companies.map((c) => (
                <button
                  key={c.rcNumber}
                  type="button"
                  onClick={() => {
                    setSelectedCompany(c);
                    setCacStep('confirm');
                  }}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <p className="font-semibold">{c.approvedName}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{c.rcNumber}</span>
                    <StatusBadge status={c.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
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
          fileInputRef={fileInputRef}
          filePreview={filePreview}
          onBack={() => setCacStep('confirm')}
          onFileChange={handleFileChange}
          onUpload={handleUpload}
          selectedFile={selectedFile}
          uploading={uploading}
        />
      )}

      {cacStep === 'result' &&
        verifyResult &&
        (verifyResult.verified ? (
          <AlertBanner variant="success" icon={CheckCircle2}>
            Certificate verified successfully
          </AlertBanner>
        ) : (
          <div className="space-y-3">
            <AlertBanner variant="warning" icon={XCircle}>
              {verifyResult.reason || 'Certificate could not be verified.'}
            </AlertBanner>
            <Button variant="outline" onClick={resetToSearch}>
              Try Again
            </Button>
          </div>
        ))}
    </div>
  );
}
