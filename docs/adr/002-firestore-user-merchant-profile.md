# ADR 002: Firestore User and Merchant Profile Storage

## Status
Accepted

## Context
The onboarding process needs to persist merchant data and create a user account. The hardcoded business type in the product form needs to be replaced with the actual business type selected by the user during onboarding. This requires a database to store merchant profiles and a way to associate them with users.

## Decision
We will use Firebase for user authentication and Firestore for data storage.

1.  **Firebase Authentication:**
    *   A new user will be created using `createUserWithEmailAndPassword` during the onboarding process.
    *   For simplicity in this development phase, a random email and password will be generated. In a real application, this would be a proper user registration flow.
    *   The user will be automatically signed in after creation to maintain the session.

2.  **Firestore Database:**
    *   A `merchants` collection will be created in Firestore.
    *   Each document in this collection will be identified by the user's UID from Firebase Auth.
    *   The merchant's profile data (business name, business type, logo, and brand colors) will be stored in this document.

3.  **Data Flow:**
    *   On submission of the onboarding form, a new user is created in Firebase Auth.
    *   The merchant's data, including the final business type, is saved to a Firestore document in the `merchants` collection, with the document ID being the new user's UID.
    *   The `useMerchant` hook will fetch the logged-in user's data and their associated merchant profile from Firestore.
    *   The `AddProductForm` will use the `useMerchant` hook to get the merchant's business type, which will then be used when generating product descriptions.

## Consequences

### Positive
- **Scalable Data Storage:** Firestore provides a scalable and reliable solution for storing merchant data.
- **Decoupled Authentication:** Firebase Auth handles user management, separating it from the application logic.
- **Centralized Data:** The merchant's business type is stored in one place and can be accessed throughout the application.
- **Personalized AI:** The AI-powered features can now use the merchant's actual business type to provide more relevant and personalized results.

### Negative
- **Vendor Lock-in:** This decision ties the application to the Firebase ecosystem.
- **Data-modeling:** The current data model is simple. As the application grows, the data model may need to be updated to handle more complex scenarios.

## Alternatives Considered
- **Local Storage:** Storing data in the browser's local storage was considered but rejected because it is not persistent and cannot be accessed across different devices.
- **Relational Database:** A traditional SQL database was considered but rejected due to the overhead of setting up and managing a database server for the current needs of the application.

## Implementation Notes
- The Firebase configuration is stored in `src/lib/firebase.ts`.
- The `merchantSchema` in `src/schemas/merchant.ts` defines the structure of the merchant data.
- The `saveMerchantData` and `getMerchantData` functions in `src/services/merchantService.ts` handle the interaction with Firestore.
- The `useMerchant` hook in `src/hooks/use-merchant.ts` provides a simple way to access the merchant's data.

## AI Context
- When working with merchant data, use the `useMerchant` hook to access the data.
- When saving merchant data, use the `saveMerchantData` function.
- The business type is now available in the `merchant` object provided by the `useMerchant` hook. Use this to provide personalized AI features.
