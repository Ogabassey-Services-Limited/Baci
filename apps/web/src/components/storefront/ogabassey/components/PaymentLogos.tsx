'use client';

import Image from 'next/image';

/**
 * Payment partner logos with proper accessibility and semantic SEO.
 * Uses Next.js Image for optimization and includes alt text for screen readers.
 */

// Official logo URLs - using reliable CDN sources
const PAYMENT_LOGOS = {
    paystack: {
        src: 'https://website-v3-assets.s3.amazonaws.com/assets/img/hero/Paystack-mark-white-twitter.png',
        alt: 'Paystack - Secure payment gateway for Africa',
        width: 24,
        height: 24,
        bgColor: 'bg-[#00C3F9]',
    },
    korapay: {
        src: 'https://korapay.com/favicon.ico',
        alt: 'Korapay - African payment infrastructure',
        width: 20,
        height: 20,
        bgColor: 'bg-[#2D0052]',
    },
    credpal: {
        src: 'https://credpal.com/favicon.ico',
        alt: 'CredPal - Buy now pay later in Nigeria',
        width: 20,
        height: 20,
        bgColor: 'bg-[#0066FF]',
    },
    credit_direct: {
        src: 'https://creditdirect.ng/favicon.ico',
        alt: 'Credit Direct - Consumer lending in Nigeria',
        width: 20,
        height: 20,
        bgColor: 'bg-[#1E3A5F]',
    },
    juicyway: {
        src: 'https://juicyway.com/favicon.ico',
        alt: 'Juicyway - Multi-currency payment gateway',
        width: 20,
        height: 20,
        bgColor: 'bg-[#6366F1]',
    },
    bank_transfer: {
        src: 'https://website-v3-assets.s3.amazonaws.com/assets/img/hero/Paystack-mark-white-twitter.png',
        alt: 'Bank Transfer - Automated via Paystack',
        width: 24,
        height: 24,
        bgColor: 'bg-[#011B33]',
    },
} as const;

export type PaymentPartner = keyof typeof PAYMENT_LOGOS;

interface PaymentLogoProps {
    partner: PaymentPartner;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    showBackground?: boolean;
}

/**
 * Accessible payment partner logo component
 * Uses semantic <figure> with <figcaption> for SEO
 */
export function PaymentLogo({
    partner,
    size = 'md',
    className = '',
    showBackground = true
}: PaymentLogoProps) {
    const logo = PAYMENT_LOGOS[partner];

    if (!logo) {
        return null;
    }

    const sizeClasses = {
        sm: 'w-5 h-5',
        md: 'size-6',
        lg: 'w-8 h-8',
    };

    const containerSizes = {
        sm: 'size-6',
        md: 'w-8 h-8',
        lg: 'w-10 h-10',
    };

    return (
        <figure
            className={`inline-flex ${className}`}
            role="img"
            aria-label={logo.alt}
        >
            {showBackground ? (
                <span
                    className={`${containerSizes[size]} ${logo.bgColor} rounded-lg flex items-center justify-center p-1`}
                    aria-hidden="true"
                >
                    <Image
                        src={logo.src}
                        alt="" // Empty alt since figure has aria-label
                        width={logo.width}
                        height={logo.height}
                        className={`${sizeClasses[size]} object-contain`}
                        loading="lazy"
                        unoptimized // External URLs
                    />
                </span>
            ) : (
                <Image
                    src={logo.src}
                    alt="" // Empty alt since figure has aria-label
                    width={logo.width}
                    height={logo.height}
                    className={`${sizeClasses[size]} object-contain`}
                    loading="lazy"
                    unoptimized
                />
            )}
            {/* Hidden figcaption for SEO - screen readers use aria-label */}
            <figcaption className="sr-only">{logo.alt}</figcaption>
        </figure>
    );
}

/**
 * Fallback SVG logos for when external images fail to load
 */
export function PaystackLogo({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            role="img"
            aria-label="Paystack payment gateway logo"
        >
            <title>Paystack</title>
            <rect width="24" height="24" rx="4" fill="#00C3F9" />
            <path
                d="M7 8h10M7 12h8M7 16h6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function KorapayLogo({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            role="img"
            aria-label="Korapay payment gateway logo"
        >
            <title>Korapay</title>
            <rect width="24" height="24" rx="4" fill="#2D0052" />
            <path
                d="M8 6v12M8 12l6-6M8 12l6 6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function CredPalLogo({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            role="img"
            aria-label="CredPal buy now pay later logo"
        >
            <title>CredPal</title>
            <rect width="24" height="24" rx="4" fill="#0066FF" />
            <text
                x="12"
                y="16"
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
            >
                CP
            </text>
        </svg>
    );
}

export function CreditDirectLogo({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            role="img"
            aria-label="Credit Direct lending logo"
        >
            <title>Credit Direct</title>
            <rect width="24" height="24" rx="4" fill="#1E3A5F" />
            <text
                x="12"
                y="16"
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
            >
                CD
            </text>
        </svg>
    );
}

export function JuicywayLogo({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            role="img"
            aria-label="Juicyway payment gateway logo"
        >
            <title>Juicyway</title>
            <rect width="24" height="24" rx="4" fill="#6366F1" />
            <text
                x="12"
                y="16"
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
            >
                JW
            </text>
        </svg>
    );
}

export function BankTransferLogo({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            role="img"
            aria-label="Secure bank transfer logo"
        >
            <title>Bank Transfer</title>
            <rect width="24" height="24" rx="4" fill="#011B33" />
            <path
                d="M12 6L6 11V18H18V11L12 6Z"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinejoin="round"
            />
            <path
                d="M4 18H20"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function PayPalLogo({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            role="img"
            aria-label="PayPal payment gateway logo"
        >
            <title>PayPal</title>
            <rect width="24" height="24" rx="4" fill="#FFFFFF" />
            <path
                d="M9.3 18.2H7.2l1.7-10.7h3.9c1.9 0 3.2 1 2.9 2.9-.3 2.1-2 3.2-4.1 3.2H10l-.7 4.6Z"
                fill="#003087"
            />
            <path
                d="M11.6 16.7H9.5l1.7-10.7h3.9c1.9 0 3.2 1 2.9 2.9-.3 2.1-2 3.2-4.1 3.2h-1.5l-.7 4.6Z"
                fill="#0070E0"
            />
        </svg>
    );
}

/**
 * Payment methods trust badges for checkout footer
 */
export function PaymentTrustBadges() {
    return (
        <section
            className="flex flex-wrap items-center justify-center gap-4 py-4"
            aria-label="Accepted payment methods"
        >
            <span className="text-xs text-store-background-text/60 font-medium">
                Secure payments via
            </span>
            <ul className="flex items-center gap-2">
                <li><PaystackLogo className="size-6" /></li>
                <li><KorapayLogo className="size-6" /></li>
                <li><CredPalLogo className="size-6" /></li>
                <li><CreditDirectLogo className="size-6" /></li>
            </ul>
        </section>
    );
}
