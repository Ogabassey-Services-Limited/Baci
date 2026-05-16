import { Alert, Linking, Platform } from 'react-native';

/**
 * Utility to help manage subscriptions natively
 */
export const SubscriptionManagement = {
  getManagementLabel: (platformOs: string = Platform.OS) => {
    return platformOs === 'ios'
      ? 'Manage in App Store'
      : 'Manage in Google Play';
  },

  /**
   * Opens the native subscription management page for the current platform
   * @returns true if successful, false if failed
   */
  openNativeManagement: async (): Promise<boolean> => {
    const iosUrl = 'https://apps.apple.com/account/subscriptions';
    const androidPackage = 'com.ogabassey.baci';
    const androidUrl = `https://play.google.com/store/account/subscriptions?package=${androidPackage}`;

    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL(iosUrl);
        return true;
      } else if (Platform.OS === 'android') {
        await Linking.openURL(androidUrl);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to open subscription management:', error);

      // Try fallback: open device settings on iOS, general Play Store on Android
      try {
        if (Platform.OS === 'ios') {
          await Linking.openSettings();
          return true;
        } else if (Platform.OS === 'android') {
          // Fallback to general Play Store subscriptions page
          await Linking.openURL(
            'https://play.google.com/store/account/subscriptions'
          );
          return true;
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }

      // Show user feedback if all attempts failed
      Alert.alert(
        'Unable to Open',
        `Could not open subscription management. Please ${SubscriptionManagement.getManagementLabel().toLowerCase()} directly.`,
        [{ text: 'OK' }]
      );
      return false;
    }
  },

  /**
   * Gets a user-friendly label for the current plan
   */
  getPlanLabel: (isPro: boolean) => {
    return isPro ? 'Baci Pro' : 'Free Plan';
  },
};
