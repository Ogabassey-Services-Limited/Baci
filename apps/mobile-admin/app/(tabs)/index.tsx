/**
 * Index Redirect - Redirects to Home tab
 * This ensures Home is the default screen when the app opens
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
