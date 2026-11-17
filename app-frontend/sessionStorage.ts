import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const sessionKey = 'doodledungeon.session';

export async function loadSession(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(sessionKey);
  }

  return SecureStore.getItemAsync(sessionKey);
}

export async function saveSession(session: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(sessionKey, session);
    return;
  }

  await SecureStore.setItemAsync(sessionKey, session);
}

export async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(sessionKey);
    return;
  }

  await SecureStore.deleteItemAsync(sessionKey);
}
