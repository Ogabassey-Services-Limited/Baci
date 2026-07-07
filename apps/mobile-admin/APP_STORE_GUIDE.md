# App Store Submission Guide
## Baci Mobile Admin - iOS & Android

This guide walks you through previewing and submitting the Baci Mobile Admin app to the Apple App Store and Google Play Store.

---

## Quick Preview (Development)

### Option 1: Expo Go (Fastest - No Native Code)
**Note**: This won't work with custom native modules like `expo-camera`. Use Option 2 instead.

```bash
# Start the development server
npm start

# Scan the QR code with:
# - iOS: Camera app
# - Android: Expo Go app
```

### Option 2: Development Build (Recommended)
This creates a custom development app with all native modules:

```bash
# Build development app
npx eas build --profile development --platform ios
npx eas build --profile development --platform android

# Once built, install on your device and run:
npm start --dev-client
```

### Option 3: Local Build (Requires Xcode/Android Studio)
```bash
# iOS (requires Mac with Xcode)
npm run ios

# Android (requires Android Studio)
npm run android
```

---

## App Store Submission Process

### Prerequisites

1. **EAS Account Setup**
   ```bash
   # Already logged in as: ogabassey
   npx eas whoami
   ```

2. **Create EAS Project**
   ```bash
   # This will create a project ID and update app.json
   npx eas init
   ```

3. **Apple Developer Account**
   - Enroll at: https://developer.apple.com
   - Cost: $99/year
   - Create App ID: `com.baci.admin`
   - Create provisioning profiles

4. **Google Play Developer Account**
   - Sign up at: https://play.google.com/console
   - One-time fee: $25
   - Create app listing

---

## iOS App Store Submission

### Step 1: Prepare Assets

Create App Store screenshots (required sizes):
- 6.7" (iPhone 15 Pro Max): 1290 x 2796
- 6.5" (iPhone 11 Pro Max): 1242 x 2688
- 5.5" (iPhone 8 Plus): 1242 x 2208

### Step 2: Update App Metadata

Edit `app.json` with App Store Connect information:

```json
{
  "expo": {
    "name": "Baci Admin",
    "ios": {
      "bundleIdentifier": "com.baci.admin",
      "buildNumber": "1"
    }
  }
}
```

### Step 3: Build for Production

```bash
# Build iOS app (creates .ipa file)
npx eas build --platform ios --profile production

# This will:
# - Upload source code to EAS servers
# - Compile native iOS app
# - Sign with your certificates
# - Provide download link (~15-20 minutes)
```

### Step 4: Submit to App Store

```bash
# Auto-submit to App Store Connect
npx eas submit --platform ios

# Or manually:
# 1. Download .ipa from EAS build page
# 2. Upload via Transporter app
# 3. Go to App Store Connect
# 4. Create new app version
# 5. Fill in metadata
# 6. Submit for review
```

### Step 5: App Store Connect Metadata

Fill in the following in App Store Connect:

**App Information:**
- Name: Baci Admin
- Subtitle: Merchant Order & Inventory Management
- Category: Business
- Age Rating: 4+

**Description:**
```
Baci Admin is a powerful mobile app for merchants to manage their online stores on-the-go.

FEATURES:
• Real-time order management
• Instant order status updates
• Inventory tracking with low stock alerts
• Barcode scanning for quick product lookup
• Business analytics and insights
• Customer information management
• Multi-store support

Perfect for merchants who need to stay connected to their business anywhere, anytime.
```

**Keywords:**
```
merchant, admin, inventory, orders, business, e-commerce, sales, retail, POS, barcode
```

**Privacy Policy URL:**
```
https://yourdomain.com/privacy-policy
```

**Support URL:**
```
https://yourdomain.com/support
```

---

## Android Play Store Submission

### Step 1: Prepare Assets

Create Play Store screenshots (required):
- Phone: 1080 x 1920 (minimum 2 screenshots)
- 7" Tablet: 1200 x 1920
- 10" Tablet: 1600 x 2560
- Feature Graphic: 1024 x 500

### Step 2: Update App Metadata

Edit `app.json`:

```json
{
  "expo": {
    "android": {
      "package": "com.baci.admin",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

### Step 3: Build for Production

```bash
# Build Android App Bundle (.aab)
npx eas build --platform android --profile production

# For testing, build APK:
npx eas build --platform android --profile preview
```

### Step 4: Create Service Account

1. Go to Google Cloud Console
2. Create service account
3. Download JSON key file
4. Save as `google-play-service-account.json` (don't commit!)

### Step 5: Submit to Play Store

```bash
# Auto-submit to Play Store
npx eas submit --platform android

# Or manually:
# 1. Go to Play Console
# 2. Create new app
# 3. Upload .aab file
# 4. Fill in store listing
# 5. Submit for review
```

### Step 6: Play Store Listing

**App Details:**
- App name: Baci Admin
- Short description: Merchant order and inventory management
- Category: Business
- Content rating: Everyone

**Full Description:**
```
Manage your online store from anywhere with Baci Admin.

POWERFUL FEATURES

📦 Order Management
• View and manage all orders in real-time
• Update order status with one tap
• Access customer information and shipping details
• Filter orders by status

📊 Inventory Control
• Track stock levels across all products
• Scan barcodes for instant product lookup
• Low stock alerts to prevent stockouts
• Quick stock adjustments

📈 Business Insights
• Daily revenue tracking
• Top-selling products
• Customer analytics
• Performance metrics

⚙️ Easy Configuration
• Store profile management
• Business hours setup
• Notification preferences
• Team member access control

BUILT FOR MERCHANTS
Whether you're running a small shop or managing multiple stores, Baci Admin gives you the tools to stay in control of your business, anytime, anywhere.

SECURE & RELIABLE
• End-to-end encryption
• Automatic data backup
• Multi-tenant architecture
• Role-based access control
```

---

## Environment Variables

Before building for production, set up environment variables:

### Create `.env` file (DO NOT COMMIT):
```env
EXPO_PUBLIC_SUPABASE_URL=https://aivqthbxdshhltbwipbr.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_actual_publishable_key_here
# Temporary fallback through 2026 only:
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your_legacy_anon_key_here
```

### For EAS Builds:

```bash
# Set secrets in EAS
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://aivqthbxdshhltbwipbr.supabase.co" --type string
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "your_key" --type string
```

---

## Build Profiles Explained

### Development
- For testing on real devices
- Includes dev tools and hot reload
- Requires development client app

### Preview
- Internal testing builds
- iOS: Installable via TestFlight or direct install
- Android: APK for easy sharing

### Production
- Final app store builds
- iOS: .ipa signed for App Store
- Android: .aab (App Bundle) for Play Store
- Auto-increments version numbers

---

## Testing Before Submission

### Internal Testing (Recommended)

**iOS - TestFlight:**
```bash
# Build and auto-upload to TestFlight
npx eas build --platform ios --profile production --auto-submit

# Add testers in App Store Connect
# Share TestFlight link with team
```

**Android - Internal Testing:**
```bash
# Upload to Play Console internal test track
npx eas submit --platform android --track internal
```

### Checklist Before Submission

- [ ] Test all features on real devices
- [ ] Verify camera permissions work
- [ ] Test order management flow
- [ ] Test inventory scanning
- [ ] Verify analytics display correctly
- [ ] Test offline functionality
- [ ] Check app icon and splash screen
- [ ] Review privacy policy compliance
- [ ] Test on multiple screen sizes
- [ ] Verify deep linking works
- [ ] Check for memory leaks
- [ ] Test push notifications

---

## Common Issues & Solutions

### Issue: Build fails with certificate errors
**Solution:**
```bash
# Clear credentials and re-create
npx eas credentials:clear
npx eas build --platform ios
```

### Issue: App crashes on launch
**Solution:**
- Check Supabase credentials are set
- Verify all native modules are configured
- Check error logs: `npx expo logs`

### Issue: Camera permission denied
**Solution:**
- Ensure permissions are in `app.json`
- Check device settings
- Reinstall app after permission changes

### Issue: Build takes too long
**Solution:**
- Use `--local` flag for local builds (if Mac/Xcode available)
- Check EAS build queue status
- Consider upgrading EAS plan for faster builds

---

## Version Management

### Updating App Version

**For iOS:**
```json
{
  "expo": {
    "version": "1.0.1",
    "ios": {
      "buildNumber": "2"
    }
  }
}
```

**For Android:**
```json
{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}
```

**Auto-increment (Production builds):**
```bash
# EAS automatically increments buildNumber/versionCode
# Just update the version string manually
```

---

## Post-Submission

### App Store Review Time
- **iOS**: 1-3 days typically
- **Android**: 1-7 days (first submission may take longer)

### After Approval

1. **Monitor Analytics**
   - Install Firebase Analytics or similar
   - Track user engagement
   - Monitor crash reports

2. **Gather Feedback**
   - Encourage user reviews
   - Set up support channel
   - Monitor app store ratings

3. **Plan Updates**
   - Fix bugs quickly
   - Add requested features
   - Keep app updated for latest iOS/Android

---

## Support & Resources

- **EAS Documentation**: https://docs.expo.dev/eas/
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Play Store Policies**: https://play.google.com/about/developer-content-policy/
- **Expo Forums**: https://forums.expo.dev

---

## Quick Reference Commands

```bash
# Preview build for testing
npx eas build --profile preview --platform all

# Production build for app stores
npx eas build --profile production --platform all

# Submit to both stores
npx eas submit --platform all

# Check build status
npx eas build:list

# View build logs
npx eas build:view [BUILD_ID]

# Update app without rebuild (minor changes)
npx eas update

# Check submission status
npx eas submit:list
```

---

**Ready to submit?** Start with preview builds for internal testing, then move to production once everything is validated. Good luck! 🚀
