'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { isAnalyticsAllowed } from '@/lib/analytics';

interface GoogleAnalyticsProps {
    measurementId: string;
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
    const [isAllowed, setIsAllowed] = useState(false);

    useEffect(() => {
        // Check consent on mount
        setIsAllowed(isAnalyticsAllowed());

        // Listen for consent changes
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'baci-cookie-consent') {
                setIsAllowed(isAnalyticsAllowed());
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Don't render if no measurement ID or consent not given
    if (!measurementId || !isAllowed) {
        return null;
    }

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${measurementId}', {
                        page_location: window.location.href,
                        page_title: document.title
                    });
                `}
            </Script>
        </>
    );
}
