# Baci Mobile Admin

**Merchant app for order fulfillment and inventory management**

Part of the Baci Multi-Tenant E-commerce Platform.

## Overview

The Baci Mobile Admin is a React Native application built with Expo, designed specifically for merchants to manage their stores on-the-go. It provides powerful tools for order fulfillment, inventory management, and business analytics.

## Architecture

### The Engine (Data Layer)
- **MMKV**: High-performance storage for instant data access
- **TanStack Query**: Smart caching with offline-first support
- **Persistence**: Query results cached for 12 hours with automatic invalidation

### The Brain (Backend)
- **Supabase**: Real-time database and authentication
- **Edge Functions**: Serverless business logic
- **Row-Level Security**: Multi-tenant data isolation

## Features

### Order Management
- Real-time order tracking
- Status updates (pending → processing → shipped → delivered)
- Customer information and shipping details
- Order filtering and search

### Inventory Control
- Product catalog management
- Stock level tracking with alerts
- Barcode scanning for quick updates
- SKU-based search

### Analytics Dashboard
- Revenue tracking
- Top-selling products
- Customer metrics
- Performance insights

### Settings & Configuration
- Store profile management
- Business hours configuration
- Notification preferences
- Team member management

## Tech Stack

- **Framework**: Expo 54 + React Native 0.81
- **Language**: TypeScript 5.9
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand + TanStack Query
- **Storage**: MMKV (fastest React Native storage)
- **Authentication**: Supabase Auth
- **UI**: Custom components with Ionicons

## Project Structure

```
baci-mobile-admin/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigator screens
│   │   ├── index.tsx      # Orders screen
│   │   ├── inventory.tsx  # Inventory management
│   │   ├── analytics.tsx  # Business analytics
│   │   └── settings.tsx   # App settings
│   ├── order/[id].tsx     # Order details
│   ├── product/[id].tsx   # Product editor
│   ├── scan.tsx           # Barcode scanner
│   └── _layout.tsx        # Root layout
├── lib/                   # Core libraries
│   ├── query-client.ts    # TanStack Query setup
│   ├── supabase.ts        # Supabase client
│   └── QueryProvider.tsx  # Query provider wrapper
├── hooks/                 # Custom hooks
│   └── useColorScheme.ts  # Theme detection
├── assets/               # Images and static files
└── app.json             # Expo configuration

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Environment Setup

Create a `.env` file (not committed to git):

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Simulator and Emulator Keyboards

If an input focuses but the on-screen keyboard does not appear, treat that as a simulator or emulator setting first.

- iOS Simulator:
  - Turn off `Hardware > Keyboard > Connect Hardware Keyboard` when you need the software keyboard.
  - Use `Cmd-K` to toggle the on-screen keyboard.
- Android Emulator:
  - Enable the virtual keyboard when a hardware keyboard is attached.
  - Typical path: `Settings > System > Languages & input > Physical keyboard > Show virtual keyboard`.

This is a simulator or emulator configuration issue unless `TextInput` focus itself is failing.

### Firebase iOS Config

`GoogleService-Info.plist` is intentionally tracked for the admin app. Firebase client
configuration is bundled into the shipped iOS binary anyway, and Xcode Cloud requires a
deterministic plist at checkout time to archive successfully. The tracked plist must only
contain standard client-side Firebase identifiers such as bundle ID, app ID, project ID,
OAuth client IDs, and the restricted mobile API key. Do not commit Firebase Admin SDK
keys, service account JSON, or any other server-side credentials. Android Firebase config
stays secret-backed in CI.

## Development Guidelines

### Code Standards
- TypeScript strict mode enabled
- Functional components with hooks
- Descriptive component and variable names
- Comments for complex business logic

### Performance Principles
- MMKV for all local storage (10x faster than AsyncStorage)
- TanStack Query for smart data fetching and caching
- Offline-first architecture with automatic retry
- FlashList for long scrollable lists

### UI/UX Guidelines
- Professional admin theme (dark slate + blue accent)
- Consistent spacing and typography
- Clear status indicators and feedback
- Touch-friendly controls (min 44px tap targets)

## Multi-Tenant Architecture

This admin app shares the same backend infrastructure with:
- **baci-web-platform**: The main merchant dashboard (web)
- **baci-mobile-storefront**: Customer-facing mobile app

All apps use the same:
- Supabase database with RLS policies
- Edge Functions for business logic
- Shared data models and validation (Zod schemas)

## Key Differences from Storefront

While the admin app uses the same "Engine" and "Brain" as the storefront:

1. **Shorter cache time**: 2 minutes stale time vs 5 minutes (admin needs fresher data)
2. **Admin theme**: Professional dark slate vs customer-friendly colors
3. **Different permissions**: Admin RLS policies vs customer policies
4. **Barcode scanning**: Integrated for inventory management
5. **Order management**: Full CRUD vs read-only order history

## Roadmap

- [ ] Real-time order notifications with push
- [ ] Bulk inventory updates via CSV
- [ ] Advanced analytics with charts
- [ ] Thermal printer integration
- [ ] Team member role management
- [ ] Multi-language support

## Related Projects

- [baci-web-platform](../baci-web-platform) - Main web dashboard
- [baci-mobile-storefront](../baci-mobile-storefront) - Customer mobile app

## License

Proprietary - Baci Platform
