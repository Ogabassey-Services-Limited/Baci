// Run with: npx expo run:ios --device then in JS debugger:
// require('./scripts/reset-onboarding')
const AsyncStorage = require('@react-native-async-storage/async-storage');
AsyncStorage.default.removeItem('baci_has_seen_onboarding').then(() => {
  console.log('Onboarding reset! Restart the app to see it again.');
});
