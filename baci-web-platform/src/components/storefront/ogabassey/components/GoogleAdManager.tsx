'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

declare global {
    interface Window {
        googletag: any;
    }
}

export const GoogleAdManager = () => {
    const pathname = usePathname();

    useEffect(() => {
        // 1. Initialize googletag queue if not already done
        window.googletag = window.googletag || { cmd: [] };

        // 2. Load the GPT script
        const script = document.createElement('script');
        script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
        script.async = true;
        script.type = 'text/javascript';
        document.head.appendChild(script);

        // 3. Global Configuration
        window.googletag.cmd.push(() => {
            // Enable Single Request Architecture (SRA) for performance
            window.googletag.pubads().enableSingleRequest();

            // Collapse empty divs to prevent whitespace if no ad is returned
            window.googletag.pubads().collapseEmptyDivs();

            // Enable services
            window.googletag.enableServices();
        });

        return () => {
            // Cleanup if needed (rarely for the global script)
            // document.head.removeChild(script); 
        };
    }, []);

    // 4. Handle Route Changes (SPA)
    // GPT doesn't automatically refresh on route changes in SPAs like Next.js.
    // We need to clear and refresh slots, but that's handled at the AdUnit level usually.
    // However, we can set page-level targeting here if needed.
    useEffect(() => {
        if (window.googletag?.pubads) {
            window.googletag.cmd.push(() => {
                window.googletag.pubads().setTargeting('path', pathname || '/');
                // window.googletag.pubads().refresh(); // Don't refresh globally, let units handle it
            });
        }
    }, [pathname]);

    return null;
};
