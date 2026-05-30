type NativeImagePicker = typeof import('expo-image-picker');
type NativeHaptics = typeof import('expo-haptics');

let imagePickerModule: NativeImagePicker | null = null;
let hapticsModule: NativeHaptics | null = null;
let nativeModulesPromise: Promise<void> | null = null;

export const ensureNegotiationNativeModules = () => {
  if (nativeModulesPromise) {
    return nativeModulesPromise;
  }

  nativeModulesPromise = Promise.all([
    import('expo-image-picker'),
    import('expo-haptics'),
  ])
    .then(([imagePicker, haptics]) => {
      imagePickerModule = imagePicker;
      hapticsModule = haptics;
    })
    .catch((error) => {
      console.debug(
        '[NegotiationModal] Native modules ignored or failed to load:',
        error
      );
    });

  return nativeModulesPromise;
};

export const getNegotiationImagePickerModule = () => imagePickerModule;
export const getNegotiationHapticsModule = () => hapticsModule;
