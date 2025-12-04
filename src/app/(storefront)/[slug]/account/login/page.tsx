'use client';

import { ArrowLeft, Loader2, Mail, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

export default function CustomerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/account';

  const { merchant, loading: merchantLoading } = useMerchant();
  const {
    isAuthenticated,
    isLoading: authLoading,
    otpState,
    sendOtp,
    verifyOtp,
  } = useCustomerAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(asRoute(redirectTo));
    }
  }, [authLoading, isAuthenticated, router, redirectTo]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSending(true);

    const result = await sendOtp(email);

    if (!result.success) {
      setError(result.error || 'Failed to send code');
    }

    setIsSending(false);
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newCode.every((d) => d) && newCode.join('').length === 6) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = [...code];
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);

    // Auto-submit if complete
    if (newCode.every((d) => d) && newCode.join('').length === 6) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleVerifyCode = async (codeString: string) => {
    setError('');
    setIsVerifying(true);

    const result = await verifyOtp(codeString);

    if (!result.success) {
      setError(result.error || 'Verification failed');
      setCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } else {
      router.push(asRoute(redirectTo));
    }

    setIsVerifying(false);
  };

  const handleResendCode = async () => {
    setError('');
    setIsSending(true);
    setCode(['', '', '', '', '', '']);

    const result = await sendOtp(otpState?.email || email);

    if (!result.success) {
      setError(result.error || 'Failed to resend code');
    }

    setIsSending(false);
  };

  if (merchantLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to store</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            {merchant?.logo_url ? (
              <Image
                src={merchant.logo_url}
                alt={merchant.business_name}
                width={48}
                height={48}
                className="h-12 w-auto mx-auto mb-2"
                unoptimized
              />
            ) : (
              <div className="h-12 w-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
            )}
            <CardTitle className="text-2xl">
              {otpState?.codeSent
                ? 'Enter verification code'
                : 'Sign in to your account'}
            </CardTitle>
            <CardDescription>
              {otpState?.codeSent
                ? `We sent a 6-digit code to ${otpState.email}`
                : 'Enter your email to receive a verification code'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!otpState?.codeSent ? (
              // Email input form
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoFocus
                      disabled={isSending}
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSending || !email}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    'Continue with email'
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By continuing, you agree to the store's terms of service and
                  privacy policy.
                </p>
              </form>
            ) : (
              // OTP verification form
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Verification code</Label>
                  <div
                    className="flex gap-2 justify-center"
                    onPaste={handlePaste}
                  >
                    {code.map((digit, index) => (
                      <Input
                        key={`otp-input-${index}`}
                        ref={(el) => {
                          codeInputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) =>
                          handleCodeChange(index, e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-14 text-center text-2xl font-mono"
                        disabled={isVerifying}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive text-center">
                    {error}
                  </p>
                )}

                {isVerifying && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying...</span>
                  </div>
                )}

                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Didn't receive the code?
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResendCode}
                    disabled={isSending}
                  >
                    {isSending ? 'Sending...' : 'Resend code'}
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setCode(['', '', '', '', '', '']);
                    setError('');
                  }}
                >
                  Use a different email
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Secure passwordless login powered by{' '}
          {merchant?.business_name || 'Baci'}
        </div>
      </footer>
    </div>
  );
}
