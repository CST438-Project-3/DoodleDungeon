import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RostersScreen from '../RostersScreen';
import { Roster, RosterClient } from '../roster';

function makeClient(): jest.Mocked<RosterClient> {
  return {
    list: jest.fn().mockResolvedValue([]), create: jest.fn(), replace: jest.fn(),
    updateMembers: jest.fn(), remove: jest.fn().mockResolvedValue(undefined),
  };
}

describe('RostersScreen', () => {
  // These are user-facing requirements: changing sessions, retrying failures, and confirming
  // a destructive action must work regardless of how the component stores its state internally.
  it('requires sign-in without fetching or inventing rosters', async () => {
    const client = makeClient();
    await render(<RostersScreen token={null} onClose={jest.fn()} client={client} />);
    expect(screen.getByText('Sign in to view and manage your rosters.')).toBeOnTheScreen();
    expect(client.list).not.toHaveBeenCalled();
  });

  it('loads the user’s rosters and displays generic guardian members', async () => {
    const client = makeClient();
    client.list.mockResolvedValue([{ rosterId: 'r1', userId: 'u1', members: [{ name: 'Oak' }, {}] }]);
    await render(<RostersScreen token="test-session" onClose={jest.fn()} client={client} />);
    expect(await screen.findByText('Roster 1')).toBeOnTheScreen();
    expect(client.list).toHaveBeenCalledWith('test-session');
    await fireEvent.press(screen.getByRole('button', { name: 'View members' }));
    expect(screen.getByText('1. Oak')).toBeOnTheScreen();
    expect(screen.getByText('2. Guardian 2')).toBeOnTheScreen();
  });

  it('shows a failed load and lets the user retry', async () => {
    const client = makeClient();
    client.list.mockRejectedValueOnce(new Error('Unable to reach the server.'));
    await render(<RostersScreen token="test-session" onClose={jest.fn()} client={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server.');
    await fireEvent.press(screen.getByRole('button', { name: 'Refresh rosters' }));
    expect(await screen.findByText('You do not have any rosters yet.')).toBeOnTheScreen();
    expect(client.list).toHaveBeenCalledTimes(2);
  });

  it('renders markup-looking guardian names as literal text', async () => {
    const client = makeClient();
    const name = '<script>alert("hello")</script>';
    client.list.mockResolvedValue([{ rosterId: 'r1', userId: 'u1', members: [{ name }] }]);
    await render(<RostersScreen token="test-session" onClose={jest.fn()} client={client} />);
    await screen.findByText('Roster 1');
    await fireEvent.press(screen.getByRole('button', { name: 'View members' }));
    expect(screen.getByText(`1. ${name}`)).toBeOnTheScreen();
  });

  it('creates a roster and requires confirmation before deleting it', async () => {
    const client = makeClient();
    client.create.mockResolvedValue({ rosterId: 'r1', userId: 'u1', members: [] });
    await render(<RostersScreen token="test-session" onClose={jest.fn()} client={client} />);
    await screen.findByText('You do not have any rosters yet.');
    await fireEvent.press(screen.getByRole('button', { name: 'Create empty roster' }));
    expect(await screen.findByText('This roster has no guardians yet.')).toBeOnTheScreen();
    expect(client.create).toHaveBeenCalledWith('test-session', []);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete roster' }));
    expect(client.remove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm deletion' }));
    expect(await screen.findByText('You do not have any rosters yet.')).toBeOnTheScreen();
    expect(client.remove).toHaveBeenCalledWith('test-session', 'r1');
  });

  it('keeps the roster visible if deletion fails', async () => {
    const client = makeClient();
    client.list.mockResolvedValue([{ rosterId: 'r1', userId: 'u1', members: [] }]);
    client.remove.mockRejectedValue(new Error('Unable to delete roster.'));
    await render(<RostersScreen token="test-session" onClose={jest.fn()} client={client} />);
    await screen.findByText('Roster 1');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete roster' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm deletion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to delete roster.');
    expect(screen.getByText('Roster 1')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm deletion' })).toBeEnabled());
  });

  it('cancels deletion without making a delete request or removing the roster', async () => {
    const client = makeClient();
    client.list.mockResolvedValue([{ rosterId: 'r1', userId: 'u1', members: [] }]);
    await render(<RostersScreen token="test-session" onClose={jest.fn()} client={client} />);
    await screen.findByText('Roster 1');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete roster' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel deletion' }));
    expect(client.remove).not.toHaveBeenCalled();
    expect(screen.getByText('Roster 1')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Confirm deletion' })).toBeNull();
  });

  it('does not invent a roster on create failure and allows a successful retry', async () => {
    const client = makeClient();
    client.create.mockRejectedValueOnce(new Error('The server could not save this roster.'))
      .mockResolvedValueOnce({ rosterId: 'r1', userId: 'u1', members: [] });
    await render(<RostersScreen token="test-session" onClose={jest.fn()} client={client} />);
    await screen.findByText('You do not have any rosters yet.');
    await fireEvent.press(screen.getByRole('button', { name: 'Create empty roster' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The server could not save this roster.');
    expect(screen.queryByText('Roster 1')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Create empty roster' }));
    expect(await screen.findByText('Roster 1')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('never displays a previous user’s late response in the new session', async () => {
    const client = makeClient();
    let completeOldRequest!: (rosters: Roster[]) => void;
    client.list.mockImplementationOnce(() => new Promise(resolve => { completeOldRequest = resolve; }))
      .mockResolvedValueOnce([{ rosterId: 'new-roster', userId: 'new-user', members: [] }]);
    const view = await render(<RostersScreen token="old-session" onClose={jest.fn()} client={client} />);
    await view.rerender(<RostersScreen token="new-session" onClose={jest.fn()} client={client} />);
    expect(await screen.findByText('ID: new-roster')).toBeOnTheScreen();
    await act(async () => {
      completeOldRequest([{ rosterId: 'old-roster', userId: 'old-user', members: [] }]);
    });
    expect(screen.queryByText('ID: old-roster')).toBeNull();
    expect(screen.getByText('ID: new-roster')).toBeOnTheScreen();
    expect(client.list).toHaveBeenLastCalledWith('new-session');
  });

  it('prevents a second create while the first request is pending', async () => {
    const client = makeClient();
    let finishCreate!: (roster: Roster) => void;
    client.create.mockImplementation(() => new Promise(resolve => { finishCreate = resolve; }));
    await render(<RostersScreen token="test-session" onClose={jest.fn()} client={client} />);
    await screen.findByText('You do not have any rosters yet.');
    await fireEvent.press(screen.getByRole('button', { name: 'Create empty roster' }));
    expect(screen.getByRole('button', { name: 'Create empty roster' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Create empty roster' }));
    expect(client.create).toHaveBeenCalledTimes(1);
    await act(async () => { finishCreate({ rosterId: 'r1', userId: 'u1', members: [] }); });
    expect(screen.getByRole('button', { name: 'Create empty roster' })).toBeEnabled();
    expect(screen.getAllByText('Roster 1')).toHaveLength(1);
  });
});
