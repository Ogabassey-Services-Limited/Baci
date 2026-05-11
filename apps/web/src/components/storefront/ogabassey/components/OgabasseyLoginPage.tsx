'use client';

import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant-client';
import { asRoute } from '@/lib/routes';
import { Logo as OgabasseyLogo } from './Logo';

// Red colors are now driven by theme variables
const OGABASSEY_RED = '#D62027';

// Validate redirect URL to prevent open redirect vulnerabilities
function sanitizeRedirect(redirect: string | null): string {
    const defaultRedirect = '/account';
    if (!redirect) return defaultRedirect;

    if (
        !redirect.startsWith('/') ||
        redirect.startsWith('//') ||
        redirect.includes(':')
    ) {
        return defaultRedirect;
    }

    return redirect;
}

/**
 * Ogabassey Premium Login Page
 * Features: Clean white background with red/white Ogabassey branding
 */
export function OgabasseyLoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = sanitizeRedirect(searchParams.get('redirect'));

    const { loading: merchantLoading } = useMerchant();
    const {
        isAuthenticated,
        isLoading: authLoading,
        otpState,
        sendOtp,
        verifyOtp,
        signInWithGoogle,
    } = useCustomerAuth();

    const [email, setEmail] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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
        if (value && !/^\d$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        if (value && index < 5) {
            codeInputRefs.current[index + 1]?.focus();
        }

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
            <div
                className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background"
            >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-gray-500">
                    {merchantLoading
                        ? 'Loading store data...'
                        : 'Checking authentication...'}
                </p>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen flex flex-col relative overflow-hidden bg-[#FAFAFA]"
        >
            {/* Soft Red Gradient Background - Premium Brand Touch */}
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#D62027]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#D62027]/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Subtle primary accent line at top */}
            <div
                className="absolute top-0 left-0 right-0 h-1.5 bg-[#D62027]"
            />

            {/* Header */}
            <header className="relative z-10 border-b border-gray-100 bg-white">
                <div className="container mx-auto px-4 h-16 flex items-center">
                    <Link
                        href={asRoute('/')}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to store</span>
                    </Link>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex items-center justify-center p-4 relative z-10">
                {/* Clean Card with subtle shadow */}
                <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl p-8 shadow-xl">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <OgabasseyLogo className="h-10 mx-auto mb-6 text-primary" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            {otpState?.codeSent
                                ? 'Enter verification code'
                                : 'Sign in or Create account'}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {otpState?.codeSent
                                ? `We sent a 6-digit code to ${otpState.email}`
                                : 'Enter your email to sign in or sign up instantly'}
                        </p>
                    </div>

                    {!otpState?.codeSent ? (
                        // Email input form
                        <form onSubmit={handleSendCode} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-gray-700">
                                    Email address
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-11 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 rounded-xl"
                                        style={{ '--tw-ring-color': `${OGABASSEY_RED}40` } as React.CSSProperties}
                                        required
                                        autoFocus
                                        disabled={isSending || isGoogleLoading}
                                    />
                                </div>
                            </div>

                            {error && <p className="text-sm text-primary">{error}</p>}

                            <Button
                                type="submit"
                                className="w-full h-12 text-white rounded-xl font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] bg-[#D62027] hover:bg-[#D62027]/90 shadow-lg shadow-red-600/10"
                                disabled={isSending || isGoogleLoading || !email}
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

                            {/* Divider */}
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="px-3 text-gray-400 bg-white">
                                        Or continue with
                                    </span>
                                </div>
                            </div>

                            {/* Google Sign-In Button */}
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-12 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl"
                                disabled={isSending || isGoogleLoading}
                                onClick={async () => {
                                    setError('');
                                    setIsGoogleLoading(true);
                                    const result = await signInWithGoogle();
                                    if (!result.success) {
                                        setError(result.error || 'Failed to sign in with Google');
                                        setIsGoogleLoading(false);
                                    }
                                }}
                            >
                                {isGoogleLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            className="mr-2 h-4 w-4"
                                            viewBox="0 0 24 24"
                                            aria-labelledby="google-logo-title"
                                        >
                                            <title id="google-logo-title">Google</title>
                                            <path
                                                fill="#4285F4"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="#34A853"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="#FBBC05"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="#EA4335"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                        Continue with Google
                                    </>
                                )}
                            </Button>

                            <p className="text-xs text-center text-gray-400">
                                By continuing, you agree to the store's terms of service and
                                privacy policy.
                            </p>

                            {/* Account Creation Notice */}
                            <p className="text-center text-gray-500 text-sm">
                                New to Ogabassey?{' '}
                                <span className="text-gray-900 font-medium">
                                    Just enter your email above to create an account
                                </span>
                            </p>
                        </form>
                    ) : (
                        // OTP verification form
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-gray-700">Verification code</Label>
                                <div
                                    className="flex gap-2 justify-center"
                                    onPaste={handlePaste}
                                >
                                    {(['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const).map(
                                        (slot, index) => (
                                            <Input
                                                key={slot}
                                                ref={(el) => {
                                                    codeInputRefs.current[index] = el;
                                                }}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={code[index]}
                                                onChange={(e) =>
                                                    handleCodeChange(index, e.target.value)
                                                }
                                                onKeyDown={(e) => handleKeyDown(index, e)}
                                                className="w-12 h-14 text-center text-2xl font-mono bg-gray-50 border-gray-200 text-gray-900 focus:border-gray-300 rounded-xl focus-visible:ring-primary/40"
                                                disabled={isVerifying}
                                                autoFocus={index === 0}
                                                aria-label={`Digit ${index + 1} of 6`}
                                            />
                                        )
                                    )}
                                </div>
                            </div>

                            {error && (
                                <p className="text-sm text-center text-primary">
                                    {error}
                                </p>
                            )}

                            {isVerifying && (
                                <div className="flex items-center justify-center gap-2 text-gray-500">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span>Verifying...</span>
                                </div>
                            )}

                            <div className="text-center space-y-2">
                                <p className="text-sm text-gray-500">
                                    Didn't receive the code?
                                </p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="hover:bg-gray-100 text-primary"
                                    onClick={handleResendCode}
                                    disabled={isSending}
                                >
                                    {isSending ? 'Sending...' : 'Resend code'}
                                </Button>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-12 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl"
                                onClick={() => {
                                    setCode(['', '', '', '', '', '']);
                                    setError('');
                                }}
                            >
                                Use a different email
                            </Button>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-gray-100 py-4 bg-white">
                <div className="container mx-auto px-4 text-center text-sm text-gray-400">
                    Secure passwordless login powered by Baci
                </div>
            </footer>
        </div>
    );
}
