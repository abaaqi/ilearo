import * as SecureStore from "expo-secure-store";

/**
 * Small values kept on the phone: the session token and the guest cart id.
 * SecureStore keeps them in the iOS Keychain / Android Keystore.
 * (storage.web.ts is used instead when the app runs in a browser.)
 */
export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
