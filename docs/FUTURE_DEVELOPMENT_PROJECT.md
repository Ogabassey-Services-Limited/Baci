# Future Development Project: Automated Mobile App Publishing

## Overview

Enable Baci merchants to publish their own branded mobile storefront apps to App Store and Google Play with minimal effort. This is a premium feature tied to Business/Enterprise subscription tiers.

---

## Competitive Landscape

| Platform | Account Model | Merchant Effort | Pricing |
|----------|---------------|-----------------|---------|
| OneMobile | Shared account | Zero | $99/mo |
| Shopney | Both options | Minimal | $149/mo |
| Vajro | Merchant's own | Create accounts, invite | $99/mo |
| MobiLoud | Merchant's own | Provide assets, test | $500/mo |
| Tapcart | Merchant's own | Create accounts (guided) | $250/mo |

---

## Baci's Approach: Hybrid Model

### Tier 1: Baci Shared Account (Default)

**For:** Most merchants on Business plan

```
Merchant Experience:
1. Click "Publish Mobile App" in dashboard
2. Preview app with their branding
3. Click "Submit"
4. Wait 1-3 days for approval
5. App is live

App Store Listing:
- Name: "StoreName - Powered by Baci"
- Publisher: Baci Commerce Ltd
- Full functionality, merchant's branding
```

**Benefits:**
- Zero setup for merchant
- No $124/year developer account fees
- Faster approval (established Baci account)
- Baci handles all rejections/resubmissions

**Technical:**
- All apps under single Baci Apple/Google developer accounts
- Each app has unique bundle ID: `com.baci.store.{merchant-slug}`
- OTA updates pushed to all apps simultaneously

---

### Tier 2: Merchant's Own Account (Premium Add-on)

**For:** Enterprise merchants wanting full brand ownership

```
Merchant Experience:
1. Create Apple Developer account ($99/yr)
2. Create Google Play account ($25 one-time)
3. Invite Baci to accounts (guided wizard)
4. Click "Publish Mobile App"
5. Baci submits on their behalf
6. App is live under merchant's name

App Store Listing:
- Name: "StoreName"
- Publisher: Merchant's Company Name
- Full ownership and control
```

**Pricing Add-on:** +$50/month or included in Enterprise

---

## Technical Architecture

### Cost Optimization

| Action | Cost | Frequency |
|--------|------|-----------|
| Initial build (iOS + Android) | ~$2-4 | Once per merchant |
| OTA updates (bug fixes, features) | FREE | Unlimited |
| Rebuild (icon/native changes) | ~$2 | Rare |

**Strategy:** Use EAS Build for initial publish, EAS Update (OTA) for all subsequent changes.

### Digital Consistency

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Web Storefront │     │    Supabase     │     │   Mobile App     │
│   (Next.js)      │◄───►│    Database     │◄───►│   (Expo)         │
└──────────────────┘     └─────────────────┘     └──────────────────┘

All data synced in real-time:
- Products, categories, inventory
- Orders, customers
- Brand colors, logo (API override)
- Store settings, pages
- Discounts, loyalty programs
```

### Branding: Hybrid Approach

```typescript
// Mobile app loads branding with fallback
const branding = {
  // Baked in at build time (fast initial load)
  primary: Constants.expoConfig?.extra?.primaryColor,
  logo: require('./assets/logo.png'),

  // Override from API (if merchant updated after build)
  ...await fetchMerchantBranding(merchantSlug),
};
```

- App works immediately with baked-in branding
- Merchant updates colors/logo on web → reflects on mobile without rebuild
- Only rebuild needed for App Store icon changes

### Update Strategy

| Update Type | Method | Cost | Who Triggers |
|-------------|--------|------|--------------|
| Bug fixes | OTA | Free | Baci (auto) |
| New features | OTA | Free | Baci (auto) |
| Branding sync | OTA | Free | Merchant (manual) |
| App icon change | Rebuild | ~$2 | Merchant request |
| Native SDK upgrade | Rebuild | ~$2 | Baci (major version) |

---

## Database Schema

### New Tables

```sql
-- Mobile app builds tracking
CREATE TABLE mobile_app_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,

  -- Configuration
  app_name TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  build_number INTEGER DEFAULT 1,

  -- Status: pending|queued|building|built|submitting|submitted|live|failed
  ios_status TEXT DEFAULT 'pending',
  android_status TEXT DEFAULT 'pending',

  -- EAS IDs
  eas_ios_build_id TEXT,
  eas_android_build_id TEXT,

  -- Artifacts
  ios_build_url TEXT,
  android_build_url TEXT,

  -- Errors
  ios_error TEXT,
  android_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store credentials (for merchant's own account option)
CREATE TABLE mobile_store_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE UNIQUE,

  -- Apple App Store Connect (encrypted)
  asc_key_id TEXT,
  asc_issuer_id TEXT,
  asc_private_key_encrypted TEXT,

  -- Google Play Console (encrypted)
  gpc_service_account_encrypted TEXT,

  -- Verification
  ios_verified BOOLEAN DEFAULT false,
  android_verified BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated app assets
CREATE TABLE mobile_app_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE UNIQUE,

  icon_1024_url TEXT,
  icon_192_url TEXT,
  adaptive_icon_url TEXT,
  splash_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add to merchants table
ALTER TABLE merchants
ADD COLUMN mobile_app_enabled BOOLEAN DEFAULT false,
ADD COLUMN mobile_app_account_type TEXT DEFAULT 'baci', -- 'baci' or 'own'
ADD COLUMN latest_mobile_build_id UUID REFERENCES mobile_app_builds(id);
```

### Feature Flag Addition

```typescript
// In src/lib/feature-flags.ts
export const FEATURES = {
  // ... existing features
  MOBILE_APP_PUBLISHING: 'mobile_app_publishing',
};

// Add to PLAN_FEATURES
business: [...existing, FEATURES.MOBILE_APP_PUBLISHING],
enterprise: [...existing, FEATURES.MOBILE_APP_PUBLISHING],
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mobile-app/builds` | POST | Initiate new build |
| `/api/mobile-app/builds` | GET | List merchant's builds |
| `/api/mobile-app/builds/[id]` | GET | Get build status |
| `/api/mobile-app/builds/[id]/retry` | POST | Retry failed build |
| `/api/mobile-app/credentials` | GET/PUT | Manage store credentials |
| `/api/mobile-app/credentials/verify` | POST | Verify credentials work |
| `/api/mobile-app/assets/generate` | POST | Generate icons from logo |
| `/api/webhooks/eas-build` | POST | EAS build status updates |
| `/api/mobile-app/worker` | POST | Process pending builds (cron) |

---

## Dashboard UI

### New Section: `/dashboard/mobile-app`

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile App                                            [?] Help │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  App Status: Not Published                    │
│  │              │                                                │
│  │   [ICON]     │  StoreName                                    │
│  │              │  com.baci.store.storename                     │
│  └──────────────┘                                                │
│                                                                  │
│  Account Type: ○ Baci Shared (Recommended)                      │
│                ○ My Own Account (+$50/mo)                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    [Publish Mobile App]                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  Build History                                                   │
│                                                                  │
│  No builds yet                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Build Progress View

```
┌─────────────────────────────────────────────────────────────────┐
│  Building Your App...                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  iOS                                    Android                  │
│  ════════════════════                   ════════════════════     │
│  ✓ Generating icons                     ✓ Generating icons      │
│  ✓ Creating app bundle                  ✓ Creating app bundle   │
│  ● Building (12 min)                    ✓ Built successfully    │
│  ○ Submitting to App Store              ● Submitting to Play    │
│  ○ In Review                            ○ In Review             │
│  ○ Live                                 ○ Live                  │
│                                                                  │
│  Estimated time remaining: ~45 minutes                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Database migrations
- [ ] Feature flag addition
- [ ] Asset generation service (Sharp)
- [ ] Basic API endpoints

### Phase 2: Baci Shared Account
- [ ] EAS Build integration
- [ ] EAS Submit integration (Baci credentials)
- [ ] Webhook handler for build status
- [ ] Worker for background processing
- [ ] Dashboard UI (basic)

### Phase 3: Dashboard Polish
- [ ] Build progress tracking
- [ ] Build history
- [ ] Asset preview
- [ ] Error handling UI

### Phase 4: Merchant's Own Account (Optional)
- [ ] Credential setup wizard
- [ ] Credential encryption/storage
- [ ] Credential verification
- [ ] Submit with merchant credentials

### Phase 5: OTA Updates
- [ ] EAS Update integration
- [ ] "Sync App" button for merchants
- [ ] Automatic updates from Baci

---

## Environment Variables

```bash
# Expo/EAS
EXPO_TOKEN=                           # Expo access token
EAS_PROJECT_ID=                       # Mobile template project ID

# Baci's Store Credentials (for shared account)
BACI_ASC_KEY_ID=                      # App Store Connect API Key ID
BACI_ASC_ISSUER_ID=                   # App Store Connect Issuer ID
BACI_ASC_PRIVATE_KEY=                 # Base64 encoded .p8 key
BACI_GPC_SERVICE_ACCOUNT=             # Base64 encoded Google service account JSON

# Security
CREDENTIALS_ENCRYPTION_KEY=           # AES-256 key for merchant credentials

# Worker
MOBILE_APP_WORKER_SECRET=             # Cron job authentication
```

---

## Files to Create/Modify

### New Files
```
apps/web/src/app/api/mobile-app/builds/route.ts
apps/web/src/app/api/mobile-app/builds/[id]/route.ts
apps/web/src/app/api/mobile-app/credentials/route.ts
apps/web/src/app/api/mobile-app/assets/route.ts
apps/web/src/app/api/webhooks/eas-build/route.ts
apps/web/src/app/api/mobile-app/worker/route.ts
apps/web/src/app/dashboard/mobile-app/page.tsx
apps/web/src/services/mobile-app/asset-generator.ts
apps/web/src/services/mobile-app/config-generator.ts
apps/web/src/services/mobile-app/eas-build.ts
apps/web/src/services/mobile-app/eas-submit.ts
apps/web/src/components/dashboard/mobile-app/overview.tsx
apps/web/src/components/dashboard/mobile-app/build-progress.tsx
apps/web/src/components/dashboard/mobile-app/credential-wizard.tsx
supabase/migrations/YYYYMMDD_mobile_app_publishing.sql
```

### Modified Files
```
apps/web/src/lib/feature-flags.ts              # Add MOBILE_APP_PUBLISHING
apps/web/src/app/pricing/page.tsx              # Add to Business tier features
apps/web/src/app/dashboard/client-layout.tsx   # Add nav item
baci-mobile-storefront/constants/Colors.ts     # Make configurable
baci-mobile-storefront/lib/config.ts           # Dynamic branding fetch
vercel.json                                     # Add worker cron
```

---

## Pricing Strategy

| Plan | Mobile App Feature | Account Type |
|------|-------------------|--------------|
| Free | Not available | - |
| Starter | Not available | - |
| Pro | Not available | - |
| Business ($X/mo) | Included | Baci shared |
| Enterprise | Included | Choice of Baci or own |
| Add-on | +$50/mo | Own account option |

---

## Security Considerations

1. **Credential Encryption**: AES-256 for stored Apple/Google credentials
2. **Plan Gating**: Verify `MOBILE_APP_PUBLISHING` feature before builds
3. **Rate Limiting**: Max 1 build per merchant per hour
4. **Webhook Verification**: Validate EAS webhook signatures
5. **Worker Auth**: Secret token for cron endpoint

---

## Success Metrics

- Build success rate (target: >95%)
- Time from click to live (target: <48 hours)
- Merchant adoption rate on Business plan
- App Store approval rate (target: >90% first submission)

---

## References

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [EAS Update (OTA)](https://docs.expo.dev/eas-update/introduction/)
- [OneMobile](https://onemobile.ai/) - Competitor using shared account model
- [Shopney](https://shopney.co/) - Competitor offering both models
- [MobiLoud](https://www.mobiloud.com/) - Competitor with done-for-you service
