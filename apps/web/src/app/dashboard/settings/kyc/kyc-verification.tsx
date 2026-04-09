'use client';

import { Building2, CreditCard, Fingerprint, Lock, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BvnVerification } from './bvn-verification';
import { CacVerification } from './cac-verification';
import { NinVerification } from './nin-verification';
import { VerificationBadge } from './verification-badge';

interface KycVerificationProps {
  verificationStatus: {
    nin_verified: boolean;
    bvn_verified: boolean;
    cac_verified: boolean;
    cac_approved_name: string | null;
    first_name: string | null;
    last_name: string | null;
    date_of_birth: string | null;
  };
  prefillNin: string | null;
  prefillBvn: string | null;
  prefillRcNumber: string | null;
  prefillPhone: string | null;
}

export function KycVerification({
  verificationStatus,
  prefillNin,
  prefillBvn,
  prefillRcNumber,
  prefillPhone,
}: KycVerificationProps) {
  const router = useRouter();

  const handleVerified = () => {
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>KYC Verification</CardTitle>
            <CardDescription>
              Verify your identity to enable payment processing and build trust
              with your customers.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Accordion type="multiple">
          <AccordionItem value="nin">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-muted-foreground" />
                <span>NIN Verification</span>
                <VerificationBadge verified={verificationStatus.nin_verified} />
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <NinVerification
                verified={verificationStatus.nin_verified}
                prefillNin={prefillNin}
                prefillFirstName={verificationStatus.first_name}
                prefillLastName={verificationStatus.last_name}
                prefillDateOfBirth={verificationStatus.date_of_birth}
                onVerified={handleVerified}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="bvn">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span>BVN Verification</span>
                <VerificationBadge verified={verificationStatus.bvn_verified} />
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <BvnVerification
                verified={verificationStatus.bvn_verified}
                prefillBvn={prefillBvn}
                prefillFirstName={verificationStatus.first_name}
                prefillLastName={verificationStatus.last_name}
                prefillDateOfBirth={verificationStatus.date_of_birth}
                prefillPhone={prefillPhone}
                onVerified={handleVerified}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cac">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <span>CAC Verification</span>
                <VerificationBadge verified={verificationStatus.cac_verified} />
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CacVerification
                verified={verificationStatus.cac_verified}
                cacApprovedName={verificationStatus.cac_approved_name}
                prefillRcNumber={prefillRcNumber}
                onVerified={handleVerified}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>
            Your information is encrypted and securely stored. We only use it
            for payment verification purposes.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
