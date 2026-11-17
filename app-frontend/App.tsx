import { useCallback, useEffect, useState } from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { clearSession, loadSession, saveSession } from './sessionStorage';
import HomeScreen from './src/HomeScreen';
import { apiRequest, ApiError } from './src/api';

WebBrowser.maybeCompleteAuthSession();

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
    id: string;
    email?: string;
    display_name?: string;
    avatar_url?: string;
  };
};

type StoredSession = {
  auth: AuthResponse;
  provider: AuthProvider;
};

function isSessionInvalidOrExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return true;
  }

  try {
    const encodedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(globalThis.atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '='))) as {
      exp?: number;
    };
    return typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

async function exchangeCode(
  provider: AuthProvider, code: string, redirectUri: string, clientId: string, codeVerifier?: string,
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>(`/auth/${provider.toLowerCase()}`, undefined,
    { code, redirectUri, clientId, codeVerifier });
}

export default function App() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const sessionExpired = useCallback(() => {
    setSession(null);
    void clearSession().catch(() => {});
    setError('Your session has expired. Please sign in again.');
  }, []);

  useEffect(() => {
    void loadSession()
      .then(async (storedSession) => {
        if (!storedSession) {
          return;
        }

        const restoredSession = JSON.parse(storedSession) as StoredSession;
        if (!restoredSession.auth?.token || !restoredSession.auth.user
          || isSessionInvalidOrExpired(restoredSession.auth.token)) {
          return clearSession();
        }

        try {
          await apiRequest('/users/me', restoredSession.auth.token);
        } catch (problem) {
          if (problem instanceof ApiError && problem.status === 401) {
            await clearSession();
            return;
          }
          throw problem;
        }
        setSession(restoredSession.auth);
      })
      .catch(() => {
        void clearSession().catch(() => {});
        setError('Unable to restore your session. Please sign in again.');
      })
      .finally(() => setIsLoadingSession(false));
  }, []);

  const githubClientId = (Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GITHUB_WEB_CLIENT_ID
    : process.env.EXPO_PUBLIC_GITHUB_ANDROID_CLIENT_ID) || '';

  const githubRedirectUri = Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GITHUB_WEB_REDIRECT_URI || AuthSession.makeRedirectUri()
    : 'doodledungeon://login';

  const [githubRequest, githubResponse, githubPromptAsync] = AuthSession.useAuthRequest({
    clientId: githubClientId,
    redirectUri: githubRedirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: false,
  }, github);

  const googleClientId = (Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)?.trim() || '';

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

  useEffect(() => {
    if (githubResponse?.type === 'success' && githubResponse.params.code) {
      setIsSigningIn(true);
      void exchangeCode('GitHub', githubResponse.params.code, githubRedirectUri, githubClientId, githubRequest?.codeVerifier)
        .then((authResponse) => {
          const storedSession: StoredSession = { auth: authResponse, provider: 'GitHub' };
          return saveSession(JSON.stringify(storedSession)).then(() => {
            setSession(authResponse);
          });
        })
        .catch(() => setError('GitHub sign-in failed. Check the API and OAuth settings, then try again.'))
        .finally(() => setIsSigningIn(false));
    } else if (githubResponse?.type === 'error') {
      setError('GitHub login did not complete. Please try again.');
    }
  }, [githubResponse]);

  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.params.code) {
      setIsSigningIn(true);
      void exchangeCode('Google', googleResponse.params.code, googleRedirectUri, googleClientId, googleRequest?.codeVerifier)
        .then((authResponse) => {
          const storedSession: StoredSession = { auth: authResponse, provider: 'Google' };
          return saveSession(JSON.stringify(storedSession)).then(() => {
            setSession(authResponse);
          });
        })
        .catch(() => setError('Google sign-in failed. Check the API and OAuth settings, then try again.'))
        .finally(() => setIsSigningIn(false));
    } else if (googleResponse?.type === 'error') {
      setError('Google login did not complete. Please try again.');
    }
  }, [googleResponse]);

  const logout = async () => {
    setIsLoggingOut(true);
    setError(null);
    try {
      await clearSession();
      setSession(null);
    } catch {
      setSession(null);
      setError('Logged out, but saved credentials could not be removed. Clear the app storage.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoadingSession) {
    return <View style={styles.container}><Text>Loading session...</Text></View>;
  }

  if (session) return <HomeScreen token={session.token}
    displayName={session.user.display_name || session.user.email || 'player'}
    onLogout={() => void logout()} onSessionExpired={sessionExpired} />;

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>DoodleDungeon</Text>
      <Text style={styles.subtitle}>Sign in to build your guardian collection.</Text>
      <Button title="Login with GitHub" disabled={!githubRequest || !githubClientId || isSigningIn || isLoggingOut} onPress={() => {
        setError(null);
        void githubPromptAsync().catch(() => setError('Unable to open GitHub login.'));
      }} />
      <View style={styles.spacer} />
      <Button title="Login with Google" disabled={!googleRequest || isSigningIn || isLoggingOut} onPress={() => {
        setError(null);
        if (!googleClientId) {
          setError('Google sign-in is not configured for this platform yet.');
          return;
        }
        void googlePromptAsync().catch(() => setError('Unable to open Google login.'));
      }} />
      {isSigningIn && <Text>Signing in...</Text>}
      {!githubClientId && !googleClientId && <Text style={styles.subtitle}>Set your OAuth client IDs in app-frontend/.env to enable sign-in.</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#ffffff' },
  title: { fontSize: 32, fontWeight: '800', color: '#263a35', marginBottom: 8 },
  subtitle: { color: '#52615a', marginBottom: 20, textAlign: 'center' },
  spacer: { height: 16 },
  error: { marginTop: 16, color: '#b3261e' },
});