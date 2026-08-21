'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GOOGLE_ADS_CONNECT_PATH } from './google-ads-connect-path';

interface GoogleAdsConnectButtonProps {
  label?: string;
}

export function GoogleAdsConnectButton({
  label = 'Connect Google Ads',
}: GoogleAdsConnectButtonProps) {
  return (
    <Button asChild size="sm" className="gap-2">
      <a href={GOOGLE_ADS_CONNECT_PATH}>
        {label}
        <ExternalLink className="size-4" />
      </a>
    </Button>
  );
}
