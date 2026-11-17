import { fireEvent, render, screen } from '@testing-library/react-native';
import CreateGuardianScreen from '../src/guardians/CreateGuardianScreen';

jest.mock('../src/guardians/GuardianDrawing', () => {
  const { Button, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onChange, strokes }: { onChange: (value: unknown[]) => void; strokes: unknown[] }) => (
      <Button title="Draw test stroke" onPress={() => onChange([...strokes, { color: '#000000', points: [{ x: 30, y: 50 }] }])} />
    ),
    GuardianArtwork: () => <Text>Guardian artwork</Text>,
  };
});

const onSave = jest.fn(async guardian => guardian);

beforeEach(() => { onSave.mockClear(); });

test('requires each field before creating a guardian', async () => {
  await render(<CreateGuardianScreen onClose={jest.fn()} onSave={onSave} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create guardian' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a guardian name.');
  await fireEvent.changeText(screen.getByLabelText('Guardian name'), 'Moss Knight');
  await fireEvent.press(screen.getByRole('button', { name: 'Create guardian' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a class.');
  await fireEvent.press(screen.getByRole('radio', { name: 'Warrior' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create guardian' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Draw some guardian art.');
});

test('creates a named guardian with its chosen class, then starts a fresh draft', async () => {
  await render(<CreateGuardianScreen onClose={jest.fn()} onSave={onSave} />);
  await fireEvent.changeText(screen.getByLabelText('Guardian name'), '  Moss Knight  ');
  await fireEvent.press(screen.getByRole('radio', { name: 'Mage' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Draw test stroke' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create guardian' }));
  expect(await screen.findByText('Guardian created')).toBeOnTheScreen();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Moss Knight', guardianClass: 'Mage' }));
  expect(screen.getByText('Moss Knight')).toBeOnTheScreen();
  expect(screen.getByText('Mage')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Create another guardian' }));
  expect(screen.getByLabelText('Guardian name')).toHaveDisplayValue('');
  expect(screen.getByRole('radio', { name: 'Mage' })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('undo and clear remove art, and the back button returns home', async () => {
  const onClose = jest.fn();
  await render(<CreateGuardianScreen onClose={onClose} onSave={onSave} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Draw test stroke' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Draw test stroke' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Clear art' }));
  expect(screen.getByRole('button', { name: 'Clear art' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to home' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('keeps the draft when saving fails, and allows retrying', async () => {
  const save = jest.fn().mockRejectedValueOnce(new Error('API is unavailable.')).mockImplementationOnce(async guardian => guardian);
  await render(<CreateGuardianScreen onClose={jest.fn()} onSave={save} />);
  await fireEvent.changeText(screen.getByLabelText('Guardian name'), 'Moss Knight');
  await fireEvent.press(screen.getByRole('radio', { name: 'Mage' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Draw test stroke' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create guardian' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('API is unavailable.');
  expect(screen.getByLabelText('Guardian name')).toHaveDisplayValue('Moss Knight');
  expect(screen.queryByText('Guardian created')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Create guardian' }));
  expect(await screen.findByText('Guardian created')).toBeOnTheScreen();
});

test('prevents duplicate requests while a save is pending', async () => {
  const save = jest.fn(() => new Promise<never>(() => {}));
  await render(<CreateGuardianScreen onClose={jest.fn()} onSave={save} />);
  await fireEvent.changeText(screen.getByLabelText('Guardian name'), 'Moss Knight');
  await fireEvent.press(screen.getByRole('radio', { name: 'Mage' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Draw test stroke' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create guardian' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Saving...' }));
  expect(save).toHaveBeenCalledTimes(1);
});
