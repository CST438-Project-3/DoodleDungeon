import { useEffect, useState } from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import CreateGuardianScreen from './src/guardians/CreateGuardianScreen';

WebBrowser.maybeCompleteAuthSession();

const defaultGithubClientId = 'Ov23lialuEK23i2nVmLy';
const github = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
};

const google = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

type AuthProvider = 'GitHub' | 'Google';

type AuthResponse = {
  token: string;
  user: {
    id: string | number;
    email?: string;
    display_name?: string;
    avatar_url?: string;
  };
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

async function exchangeCode(
  provider: AuthProvider,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/${provider.toLowerCase()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri, codeVerifier }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed (${response.status})`);
  }

  return response.json() as Promise<AuthResponse>;
}

export default function App() {
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProvider | null>(null);
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuardianDemo, setShowGuardianDemo] = useState(false);

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
    : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) || '';

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
      void exchangeCode('GitHub', githubResponse.params.code, githubRedirectUri, githubRequest?.codeVerifier)
        .then((authResponse) => {
          setAuthCode(githubResponse.params.code);
          setAuthProvider('GitHub');
          setSession(authResponse);
        })
        .catch(() => setError('GitHub sign-in failed. Please try again.'));
    } else if (githubResponse?.type === 'error') {
      setError('GitHub login did not complete. Please try again.');
    }
  }, [githubResponse]);

  // Handle Google Response
  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.params.code) {
      void exchangeCode('Google', googleResponse.params.code, googleRedirectUri, googleRequest?.codeVerifier)
        .then((authResponse) => {
          setAuthCode(googleResponse.params.code);
          setAuthProvider('Google');
          setSession(authResponse);
        })
        .catch(() => setError('Google sign-in failed. Please try again.'));
    } else if (googleResponse?.type === 'error') {
      setError('Google login did not complete. Please try again.');
    }
  }, [googleResponse]);

  if (showGuardianDemo) {
    return <CreateGuardianScreen onClose={() => setShowGuardianDemo(false)} />;
  }

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
          <Text>Signed in with {authProvider}.</Text>
          <Text>Welcome, {session?.user.display_name || session?.user.email || 'player'}!</Text>
          <View style={styles.spacer} />
          <Text>Your session is ready.</Text>
          <View style={styles.spacer} />
          <Button title="Reset Login" onPress={() => {
            setAuthCode(null);
            setAuthProvider(null);
            setSession(null);
            setError(null);
          }} />
        </>
      )}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <View style={styles.spacer} />
      <Button title="Try guardian creation" onPress={() => setShowGuardianDemo(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#ffffff' },
  spacer: { height: 16 },
  error: { marginTop: 16, color: '#b3261e' },
});