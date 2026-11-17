import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';
import { loadSession, clearSession } from '../sessionStorage';

jest.mock('../sessionStorage', () => ({
  loadSession: jest.fn().mockResolvedValue(null),
  saveSession: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn().mockResolvedValue(undefined),
}));

const mockRequest = {};
const mockGithubPromptAsync = jest.fn();
const mockGooglePromptAsync = jest.fn();
let mockGithubResponse: { type: string; params?: { code?: string } } | null = null;
let mockGoogleResponse: { type: string; params?: { code?: string } } | null = null;

jest.mock('expo-auth-session', () => ({
  ResponseType: { Code: 'code' },
  makeRedirectUri: jest.fn(() => 'http://localhost:8081'),
  useAuthRequest: jest.fn((_options, provider) =>
    provider.authorizationEndpoint.includes('github')
      ? [mockRequest, mockGithubResponse, mockGithubPromptAsync]
      : [mockRequest, mockGoogleResponse, mockGooglePromptAsync],
  ),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

function getButton(title: string) {
  return screen.getByRole('button', { name: title });
}

describe('App', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_GITHUB_ANDROID_CLIENT_ID = 'github-test';
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = 'google-test';
    process.env.EXPO_PUBLIC_GITHUB_WEB_CLIENT_ID = 'github-test';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'google-test';
    jest.mocked(loadSession).mockResolvedValue(null);
    jest.mocked(clearSession).mockClear();
    jest.spyOn(global, 'fetch').mockImplementation(async url => ({
      ok: true,
      json: async () => String(url).endsWith('/guardians') ? [] : ({
        token: 'session-token',
        user: { id: 'user-id', display_name: 'Test Player' },
      }),
    } as Response));
    mockGithubResponse = null;
    mockGoogleResponse = null;
    mockGithubPromptAsync.mockReset().mockResolvedValue(undefined);
    mockGooglePromptAsync.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders both login options when no response has been received', async () => {
    await render(<App />);

    expect(await screen.findByRole('button', { name: 'Login with GitHub' })).toBeEnabled();
    expect(getButton('Login with Google')).toBeEnabled();
  });

  it('shows a successful GitHub login and resets to the login options', async () => {
    const view = await render(<App />);

    mockGithubResponse = { type: 'success', params: { code: 'github-code' } };
    await view.rerender(<App />);

    expect(await screen.findByText('Welcome, Test Player!')).toBeOnTheScreen();
    expect(getButton('Create guardian')).toBeOnTheScreen();

    await fireEvent.press(getButton('Log out'));
    await view.rerender(<App />);

    expect(getButton('Login with GitHub')).toBeOnTheScreen();
    expect(getButton('Login with Google')).toBeOnTheScreen();
  });

  it('shows an error when Google login does not complete', async () => {
    const view = await render(<App />);

    mockGoogleResponse = { type: 'error' };
    await view.rerender(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Google login did not complete. Please try again.',
      );
    });
  });

  it('does not open Google when this platform has no configured client ID', async () => {
    const webId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const androidId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    try {
      await render(<App />);
      await fireEvent.press(getButton('Login with Google'));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Google sign-in is not configured for this platform yet.',
      );
      expect(mockGooglePromptAsync).not.toHaveBeenCalled();
    } finally {
      if (webId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = webId;
      if (androidId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = androidId;
    }
  });

  it('opens Google when a public client ID is configured', async () => {
    const webId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const androidId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    // Dummy IDs only; the unit test opens a mocked prompt, not Google's website.
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '123-web.apps.googleusercontent.com';
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = '123-android.apps.googleusercontent.com';
    try {
      await render(<App />);
      await fireEvent.press(getButton('Login with Google'));
      expect(mockGooglePromptAsync).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      if (webId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = webId;
      if (androidId === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = androidId;
    }
  });

  it('shows an error when the GitHub login prompt fails', async () => {
    mockGithubPromptAsync.mockRejectedValueOnce(new Error('prompt failed'));
    await render(<App />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Login with GitHub' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to open GitHub login.');
    });
  });

  it('does not show the creation button before login', async () => {
    await render(<App />);
    await screen.findByRole('button', { name: 'Login with GitHub' });
    expect(screen.queryByRole('button', { name: 'Create guardian' })).toBeNull();
  });

  it('opens creation from the plus button after login', async () => {
    const view = await render(<App />);
    mockGithubResponse = { type: 'success', params: { code: 'github-code' } };
    await view.rerender(<App />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Create guardian' }));
    expect(screen.getByLabelText('Guardian name')).toBeOnTheScreen();
    await fireEvent.press(getButton('Back to home'));
    expect(screen.getByText('Your guardians')).toBeOnTheScreen();
  });

  it('clears an expired stored session instead of opening home', async () => {
    jest.mocked(loadSession).mockResolvedValue(JSON.stringify({
      auth: { token: 'bad-token', user: { id: 'old-user' } }, provider: 'GitHub',
    }));
    await render(<App />);
    await screen.findByRole('button', { name: 'Login with GitHub' });
    expect(clearSession).toHaveBeenCalled();
    expect(screen.queryByText('Your guardians')).toBeNull();
  });
  it('shows a restore error even when saved-session cleanup also fails', async () => {
    jest.mocked(loadSession).mockRejectedValueOnce(new Error('Storage unavailable'));
    jest.mocked(clearSession).mockRejectedValueOnce(new Error('Storage unavailable'));
    await render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to restore your session. Please sign in again.',
    );
    expect(getButton('Login with GitHub')).toBeOnTheScreen();
  });

});
