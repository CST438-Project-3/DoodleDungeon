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

const defaultGoogleClientId = 'TODO_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const google = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export default function App() {
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GitHub Auth Request
  const githubClientId = (Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GITHUB_WEB_CLIENT_ID
    : process.env.EXPO_PUBLIC_GITHUB_ANDROID_CLIENT_ID) || defaultGithubClientId;

  const githubRedirectUri = Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GITHUB_WEB_REDIRECT_URI || AuthSession.makeRedirectUri()
    : 'doodledungeon://login';

  const [githubRequest, githubResponse, githubPromptAsync] = AuthSession.useAuthRequest({
    clientId: githubClientId,
    redirectUri: githubRedirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: false,
  }, github);

  // Google Auth Request
  const googleClientId = (Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) || defaultGoogleClientId;

  const googleRedirectUri = Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GOOGLE_WEB_REDIRECT_URI || AuthSession.makeRedirectUri()
    : 'doodledungeon://login';

  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest({
    clientId: googleClientId,
    redirectUri: googleRedirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
  }, google);

  // Handle GitHub Response
  useEffect(() => {
    if (githubResponse?.type === 'success' && githubResponse.params.code) {
      setAuthCode(githubResponse.params.code);
      setAuthProvider('GitHub');
    } else if (githubResponse?.type === 'error') {
      setError('GitHub login did not complete. Please try again.');
    }
  }, [githubResponse]);

  // Handle Google Response
  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.params.code) {
      setAuthCode(googleResponse.params.code);
      setAuthProvider('Google');
    } else if (googleResponse?.type === 'error') {
      setError('Google login did not complete. Please try again.');
    }
  }, [googleResponse]);

  return (
    <View style={styles.container}>
      {authCode === null ? (
        <>
          <Button title="Login with GitHub" disabled={!githubRequest} onPress={() => {
            setError(null);
            void githubPromptAsync().catch(() => setError('Unable to open GitHub login.'));
          }} />
          <View style={styles.spacer} />
          <Button title="Login with Google" disabled={!googleRequest} onPress={() => {
            setError(null);
            void googlePromptAsync().catch(() => setError('Unable to open Google login.'));
          }} />
        </>
      ) : (
        <>
          <Text>Success with {authProvider}! Code: {authCode}</Text>
          <View style={styles.spacer} />
          <Text>Now we need to send this to the backend!</Text>
          <View style={styles.spacer} />
          <Button title="Reset Login" onPress={() => {
            setAuthCode(null);
            setAuthProvider(null);
            setError(null);
          }} />
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