'use client';

import { useEffect } from 'react';

/**
 * Client component to initialize CSRF token on app load
 * This runs once when the app mounts
 */
export function CsrfInitializer() {
  useEffect(() => {
    // Initialize CSRF token
    fetch('/api/csrf')
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to initialize CSRF token');
        }
      })
      .catch((error) => {
        console.error('Error initializing CSRF token:', error);
      });
  }, []);

  // This component doesn't render anything
  return null;
}
