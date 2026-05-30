/**
 * SocialSignInButtons Component
 *
 * 2026 Best Practices:
 * - Full accessibility with aria labels
 * - Loading states
 * - Consistent styling
 */

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SocialSignInButtonsProps } from '../types';

/**
 * Google logo SVG
 */
function GoogleLogo() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

/**
 * Apple logo SVG
 */
function AppleLogo() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.548 0-1.211.516-1.211 1.164 0 .644.721 1.187 1.211 1.187.533 0 1.211-.54 1.211-1.187 0-.648-.678-1.164-1.211-1.164zm5.552 13.911c-.964.953-2.148 2.152-3.504 2.152-1.305 0-1.68-.82-3.32-.82s-2.083.82-3.327.82c-1.352 0-2.651-1.352-3.551-2.651-1.852-2.651-3.152-7.351-1.152-10.851 1.001-1.752 2.752-2.852 4.702-2.852 1.45 0 2.501.95 3.351.95s1.951-.95 3.451-.95c1.251 0 2.651.65 3.501 1.701-2.852 1.6-2.401 5.551.501 6.751-.751 2.151-2.101 4.701-3.652 6.751zM11.95 4.88c-.052-2.4 1.952-4.45 4.352-4.5s4.452 1.95 4.502 4.35c.052 2.4-1.952 4.45-4.352 4.5s-4.452-1.95-4.502-4.35z" />
    </svg>
  );
}

/**
 * Social sign-in buttons (Google and Apple)
 */
export function SocialSignInButtons({
  onGoogleSignIn,
  onAppleSignIn,
  isGoogleLoading,
  isAppleLoading,
  isDisabled,
}: SocialSignInButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Button
        type="button"
        variant="outline"
        className="h-12 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl"
        disabled={isDisabled || isGoogleLoading || isAppleLoading}
        onClick={onGoogleSignIn}
        aria-label="Sign in with Google"
      >
        {isGoogleLoading ? (
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <div className="flex items-center justify-center">
            <GoogleLogo />
            Google
          </div>
        )}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-12 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl"
        disabled={isDisabled || isGoogleLoading || isAppleLoading}
        onClick={onAppleSignIn}
        aria-label="Sign in with Apple"
      >
        {isAppleLoading ? (
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <div className="flex items-center justify-center">
            <AppleLogo />
            Apple
          </div>
        )}
      </Button>
    </div>
  );
}
