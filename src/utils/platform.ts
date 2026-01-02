import { isNative, isWeb, isIOS, isAndroid, getPlatform } from './capacitor';

/**
 * Platform utilities for conditional rendering
 */
export const Platform = {
  isNative,
  isWeb,
  isIOS,
  isAndroid,
  getPlatform,
};

/**
 * Safe area insets for mobile devices
 */
export const getSafeAreaInsets = () => {
  if (isNative()) {
    // Capacitor handles safe areas automatically with CSS variables
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    };
  }
  return {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
};

