import { useEffect, useState } from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const defaultGithubClientId = 'Ov23lialuEK23i2nVmLy';
const github = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
};

/** Opens GitHub authorization and displays the returned code. */
export default function App() {
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = (Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GITHUB_WEB_CLIENT_ID
    : process.env.EXPO_PUBLIC_GITHUB_ANDROID_CLIENT_ID) || defaultGithubClientId;
  const redirectUri = Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GITHUB_WEB_REDIRECT_URI || AuthSession.makeRedirectUri()
    : 'doodledungeon://login';
  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: false,
  }, github);

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      setAuthCode(response.params.code);
    } else if (response?.type === 'error') {
      setError('GitHub login did not complete. Please try again.');
    }
  }, [response]);

  return (
    <View style={styles.container}>
      {authCode === null ? (
        <Button title="Login with GitHub" disabled={!request} onPress={() => {
          setError(null);
          void promptAsync().catch(() => setError('Unable to open GitHub login.'));
        }} />
      ) : (
        <>
          <Text>Success! Code: {authCode}</Text>
          <View style={styles.spacer} />
          <Text>Now we need to send this to the backend!</Text>
        </>
      )}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#ffffff' },
  spacer: { height: 16 },
  error: { marginTop: 16, color: '#b3261e' },
});
