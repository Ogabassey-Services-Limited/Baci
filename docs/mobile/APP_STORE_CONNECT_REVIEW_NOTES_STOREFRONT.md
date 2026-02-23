# App Review Notes: Storefront Account Deletion

## Build

- App: Ogabassey Storefront (iOS)
- Feature: In-app account deletion for App Review Guideline 5.1.1(v)

## Reviewer Path

1. Open the app and sign in.
2. Go to `Account` tab.
3. Tap `Delete Account`.
4. Review warning details, check the confirmation checkbox, and tap `Delete Account`.
5. Confirm the destructive prompt.

## What Happens Immediately

- Authentication access is removed.
- Storefront customer profile linkage is removed.
- Wishlist entries linked to the account email are removed.
- Storefront push-token registrations linked to the user are removed.

## Data Retained for Compliance

- Historical order and transaction records are retained for legal/tax/dispute/fraud/audit requirements.

## Sign in with Apple

- If the account used Sign in with Apple, the app shows guidance with a link to [Apple's revoke-access instructions](https://support.apple.com/en-us/HT210426).
