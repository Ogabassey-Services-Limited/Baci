# Firebase Setup Instructions

## Error: auth/configuration-not-found

This error means Email/Password authentication is not enabled in your Firebase project.

### Fix Steps:

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project

2. **Enable Email/Password Authentication**
   - Click on **"Build"** → **"Authentication"** in the left sidebar
   - Click on **"Get started"** (if you haven't set up Authentication yet)
   - Go to the **"Sign-in method"** tab
   - Click on **"Email/Password"**
   - Toggle **"Enable"** to ON
   - Click **"Save"**

3. **Verify Your Configuration**
   - Make sure your `.env` file has valid Firebase credentials
   - Restart your dev server: `npm run dev`
   - Check browser console for: "✅ Firebase initialized successfully"

### Alternative: Skip Firebase for Now

If you want to test the app without setting up Firebase, you can temporarily mock the authentication:

1. Comment out the Firebase auth call in `src/app/onboarding/onboarding-form.tsx`
2. Use a mock user ID instead
3. This will let you test the UI flow

### Need Help?

Check the Firebase docs: https://firebase.google.com/docs/auth/web/password-auth
