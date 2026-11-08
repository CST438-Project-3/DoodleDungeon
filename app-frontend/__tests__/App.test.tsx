import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

function getButton(title: string) {
  return screen.getByRole('button', { name: title });
}

describe('App', () => {
  beforeEach(() => {
    mockGithubResponse = null;
    mockGoogleResponse = null;
    mockGithubPromptAsync.mockReset().mockResolvedValue(undefined);
    mockGooglePromptAsync.mockReset().mockResolvedValue(undefined);
  });

  it('renders both login options when no response has been received', async () => {
    await render(<App />);

    expect(getButton('Login with GitHub')).toBeEnabled();
    expect(getButton('Login with Google')).toBeEnabled();
  });

  it('shows a successful GitHub login and resets to the login options', async () => {
    const view = await render(<App />);

    mockGithubResponse = { type: 'success', params: { code: 'github-code' } };
    await view.rerender(<App />);

    expect(await screen.findByText('Success with GitHub! Code: github-code')).toBeOnTheScreen();

    await fireEvent.press(getButton('Reset Login'));
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

  it('shows an error when the GitHub login prompt fails', async () => {
    mockGithubPromptAsync.mockRejectedValueOnce(new Error('prompt failed'));
    await render(<App />);

    await fireEvent.press(getButton('Login with GitHub'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to open GitHub login.');
    });
  });
});
