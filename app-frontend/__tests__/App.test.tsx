import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import App from '../App';

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

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function getButton(title: string) {
  return screen.getByRole('button', { name: title });
}

describe('App', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'session-token',
        user: { id: 'user-id', display_name: 'Test Player' },
      }),
    } as Response);
    mockGithubResponse = null;
    mockGoogleResponse = null;
    jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
    jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue(undefined);
    mockGithubPromptAsync.mockReset().mockResolvedValue(undefined);
    mockGooglePromptAsync.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders both login options when no response has been received', async () => {
    await render(<App />);

    expect(await screen.findByRole('button', { name: 'Login with GitHub' })).toBeEnabled();
    expect(await screen.findByRole('button', { name: 'Login with Google' })).toBeEnabled();
  });

  it('shows a successful GitHub login and resets to the login options', async () => {
    const view = await render(<App />);

    mockGithubResponse = { type: 'success', params: { code: 'github-code' } };
    await view.rerender(<App />);

    expect(await screen.findByText('Signed in with GitHub.')).toBeOnTheScreen();
    expect(await screen.findByText('Welcome, Test Player!')).toBeOnTheScreen();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'doodledungeon.session',
      expect.stringContaining('"session-token"'),
    );

    await fireEvent.press(getButton('Log out'));

    expect(getButton('Login with GitHub')).toBeOnTheScreen();
    expect(getButton('Login with Google')).toBeOnTheScreen();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
  });

  it('restores a saved session when the app launches', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({
      auth: {
        token: 'header.eyJleHAiOjQwMDAwMDAwMDB9.signature',
        user: { id: 'user-id', display_name: 'Returning Player' },
      },
      provider: 'Google',
    }));

    await render(<App />);

    expect(await screen.findByText('Signed in with Google.')).toBeOnTheScreen();
    expect(await screen.findByText('Welcome, Returning Player!')).toBeOnTheScreen();
  });

  it('clears an expired saved session and shows login options', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({
      auth: {
        token: [
          'header',
          'eyJleHAiOjF9',
          'signature',
        ].join('.'),
        user: { id: 'user-id', display_name: 'Expired Player' },
      },
      provider: 'GitHub',
    }));

    await render(<App />);

    expect(await screen.findByRole('button', { name: 'Login with GitHub' })).toBeOnTheScreen();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
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

  it('shows an error when the GitHub login prompt fails', async () => {
    mockGithubPromptAsync.mockRejectedValueOnce(new Error('prompt failed'));
    await render(<App />);

    await fireEvent.press(getButton('Login with GitHub'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to open GitHub login.');
    });
  });
});
