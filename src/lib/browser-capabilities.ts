/**
 * Browser Capability Utilities
 *
 * Helper functions for checking network conditions and data preferences.
 * Used for progressive enhancement and respecting user bandwidth.
 */

// Network Information API types (not available in all browsers)
interface NetworkInformation {
    saveData?: boolean;
    effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
    downlink?: number;
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
}

/**
 * Check image format support (client-side)
 */
export function checkImageFormat(format: 'webp' | 'avif'): boolean {
    if (typeof document === 'undefined') return false;

    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
        const formats = {
            webp: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
            avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=',
        };
        return canvas.toDataURL(formats[format]).indexOf(`data:image/${format}`) === 0;
    }
    return false;
}

/**
 * Check if user is on a slow connection or has data-saver enabled
 */
export function isSlowConnection(): boolean {
    if (typeof navigator === 'undefined') return false;

    const nav = navigator as NavigatorWithConnection;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (!conn) return false;

    // Data saver enabled
    if (conn.saveData === true) return true;

    // Slow connection type
    const slowTypes = ['slow-2g', '2g', '3g'];
    if (conn.effectiveType && slowTypes.includes(conn.effectiveType)) return true;

    return false;
}

/**
 * Get user's preferred data usage mode
 */
export function getDataPreference(): 'save' | 'normal' | 'high-quality' {
    if (typeof navigator === 'undefined') return 'normal';

    const nav = navigator as NavigatorWithConnection;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (!conn) return 'normal';

    // Explicit data saver
    if (conn.saveData === true) return 'save';

    // Fast connection - can serve high quality
    if (conn.effectiveType === '4g' && conn.downlink && conn.downlink > 5) {
        return 'high-quality';
    }

    return 'normal';
}

/**
 * Simple browser detection (for analytics/debugging)
 */
export function getBrowserInfo() {
    if (typeof navigator === 'undefined') return { name: 'unknown', version: 'unknown' };

    const ua = navigator.userAgent;

    // Chrome
    if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
        const match = ua.match(/Chrome\/(\d+)/);
        return { name: 'Chrome', version: match ? match[1] : 'unknown' };
    }

    // Edge
    if (ua.includes('Edg/')) {
        const match = ua.match(/Edg\/(\d+)/);
        return { name: 'Edge', version: match ? match[1] : 'unknown' };
    }

    // Safari
    if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        const match = ua.match(/Version\/(\d+)/);
        return { name: 'Safari', version: match ? match[1] : 'unknown' };
    }

    // Firefox
    if (ua.includes('Firefox/')) {
        const match = ua.match(/Firefox\/(\d+)/);
        return { name: 'Firefox', version: match ? match[1] : 'unknown' };
    }

    // Opera
    if (ua.includes('OPR/') || ua.includes('Opera')) {
        return { name: 'Opera', version: 'unknown' };
    }

    // UC Browser
    if (ua.includes('UCBrowser')) {
        return { name: 'UC Browser', version: 'unknown' };
    }

    // Samsung Internet
    if (ua.includes('SamsungBrowser')) {
        const match = ua.match(/SamsungBrowser\/(\d+)/);
        return { name: 'Samsung Internet', version: match ? match[1] : 'unknown' };
    }

    return { name: 'unknown', version: 'unknown' };
}
