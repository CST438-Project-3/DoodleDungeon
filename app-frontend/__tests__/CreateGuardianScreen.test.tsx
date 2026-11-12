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

test('requires each field before creating a guardian', async () => {
  await render(<CreateGuardianScreen onClose={jest.fn()} />);
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
  await render(<CreateGuardianScreen onClose={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Guardian name'), '  Moss Knight  ');
  await fireEvent.press(screen.getByRole('radio', { name: 'Mage' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Draw test stroke' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create guardian' }));
  expect(screen.getByText('Guardian created')).toBeOnTheScreen();
  expect(screen.getByText('Moss Knight')).toBeOnTheScreen();
  expect(screen.getByText('Mage')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Create another guardian' }));
  expect(screen.getByLabelText('Guardian name')).toHaveDisplayValue('');
  expect(screen.getByRole('radio', { name: 'Mage' })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('undo and clear remove art, and the back button exits the demo', async () => {
  const onClose = jest.fn();
  await render(<CreateGuardianScreen onClose={onClose} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Draw test stroke' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Draw test stroke' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Clear art' }));
  expect(screen.getByRole('button', { name: 'Clear art' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to login' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
