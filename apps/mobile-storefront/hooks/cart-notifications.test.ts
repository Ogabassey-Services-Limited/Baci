import { Alert, Platform, ToastAndroid } from 'react-native';
import { showCartToast } from './cart-notifications';

const originalPlatformOS = Platform.OS;

function setPlatformOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

describe('cart notifications', () => {
  beforeEach(() => {
    jest.spyOn(ToastAndroid, 'show').mockImplementation(() => undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    setPlatformOS(originalPlatformOS);
    jest.restoreAllMocks();
  });

  it('uses Android toast notifications on Android', () => {
    setPlatformOS('android');

    showCartToast('Added to cart', 'success');

    expect(ToastAndroid.show).toHaveBeenCalledWith(
      'Added to cart',
      ToastAndroid.SHORT
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('uses alerts on non-Android platforms', () => {
    setPlatformOS('ios');

    showCartToast('Only 2 available', 'error');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Stock Error',
      'Only 2 available',
      [{ text: 'OK' }],
      { cancelable: true }
    );
  });
});
