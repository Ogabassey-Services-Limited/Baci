'use client';

import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  Search,
  Upload,
  XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import type { CacCompany } from './cac-ui';
import { AlertBanner, CacConfirmStep, StatusBadge } from './cac-ui';

interface CacVerificationProps {
  verified: boolean;
  prefillRcNumber: string | null;
  cacApprovedName: string | null;
  onVerified: () => void;
}

type CacStep = 'search' | 'confirm' | 'upload' | 'result';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

export function CacVerification({
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
    const res = await fetchWithCsrf(url, { method: 'POST', body });
    if (res.status === 429) {
      toast({
        variant: 'destructive',
        title: 'Too many requests',
        description: 'Please wait a moment and try again.',
      });
      return null;
    }
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(e.error || 'Request failed');
    }
    return res.json();
  }

  async function handleSearch() {
    const term = rcNumber.trim();
    if (!term) return;
    setSearching(true);
    try {
      const data = await postApi(
        '/api/merchant/cac-search',
        JSON.stringify({ searchTerm: term })
      );
      if (!data) return;
      setCompanies((data as { companies: CacCompany[] }).companies);
      if (!(data as { companies: CacCompany[] }).companies.length) {
        toast({
          title: 'No results',
          description: 'No companies found for that RC/BN number.',
        });
      }
    } catch (error) {
      toastError('Search failed', error);
    } finally {
      setSearching(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum file size is 5 MB.',
      });
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    setFilePreview(
      file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    );
  }

  async function handleUpload() {
    if (!selectedFile || !selectedCompany) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('rcNumber', selectedCompany.rcNumber);
      formData.append('approvedName', selectedCompany.approvedName);
      const data = await postApi('/api/merchant/verify-cac', formData);
      if (!data) return;
      const result = data as { verified: boolean; reason?: string };
      setVerifyResult(result);
      setCacStep('result');
      if (result.verified) onVerified();
    } catch (error) {
      toastError('Verification failed', error);
    } finally {
      setUploading(false);
    }
  }

  function resetToSearch() {
    setCacStep('search');
    setSelectedCompany(null);
    setSelectedFile(null);
    setFilePreview(null);
    setVerifyResult(null);
    setCompanies([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      {cacStep === 'search' && (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Enter RC or BN number"
              value={rcNumber}
              onChange={(e) => setRcNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              aria-label="RC or BN number"
            />
            <Button
              onClick={handleSearch}
              disabled={searching || !rcNumber.trim()}
            >
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search CAC
            </Button>
          </div>
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
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload your CAC certificate (JPEG, PNG, WebP, or PDF, max 5 MB).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
          />
          {selectedFile && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
              {filePreview && (
                // biome-ignore lint/performance/noImgElement: local blob URL preview, next/image doesn't support blob URLs
                <img
                  src={filePreview}
                  alt="Certificate preview"
                  className="mt-2 max-h-48 rounded-md object-contain"
                />
              )}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCacStep('confirm')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Verify Certificate
            </Button>
          </div>
        </div>
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
