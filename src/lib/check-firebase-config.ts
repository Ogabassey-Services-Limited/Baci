// Helper to check Firebase configuration
export function checkFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([_, value]) => !value || value === 'undefined')
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('Missing Firebase configuration:', missing);
    return false;
  }

  // Check if any values are still template strings
  const invalid = Object.entries(config)
    .filter(([_, value]) => value && (value.includes('your-') || value.includes('YOUR_')))
    .map(([key]) => key);

  if (invalid.length > 0) {
    console.error('Invalid Firebase configuration (template values):', invalid);
    return false;
  }

  return true;
}
