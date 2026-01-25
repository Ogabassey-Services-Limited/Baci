import { Linking, Platform } from 'react-native';

/**
 * Utility to help manage subscriptions natively
 */
export const SubscriptionManagement = {
    /**
     * Opens the native subscription management page for the current platform
     */
    openNativeManagement: async () => {
        try {
            if (Platform.OS === 'ios') {
                // Direct link to Apple Subscriptions management
                await Linking.openURL('https://apps.apple.com/account/subscriptions');
            } else if (Platform.OS === 'android') {
                // Direct link to Google Play Subscriptions (using package name)
                // Note: In production you'd use your actual package name
                const packageName = 'com.ogabassey.baci';
                await Linking.openURL(`https://play.google.com/store/account/subscriptions?package=${packageName}`);
            }
        } catch (error) {
            console.error('Failed to open subscription management:', error);
            // Fallback to general store if deep link fails
            if (Platform.OS === 'ios') {
                await Linking.openURL('https://apps.apple.com/account/subscriptions');
            }
        }
    },

    /**
     * Gets a user-friendly label for the current plan
     */
    getPlanLabel: (isPro: boolean) => {
        return isPro ? 'Baci Pro' : 'Free Plan';
    }
};
