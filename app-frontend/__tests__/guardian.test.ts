import { createGuardian, drawingPoint, validateGuardian, type GuardianDraft } from '../src/guardians/guardian';

const draft: GuardianDraft = {
  name: '  Moss Knight  ', guardianClass: 'Warrior',
  strokes: [{ color: '#000000', points: [{ x: 50, y: 70 }] }],
};

test('requires a name, a class, and some art', () => {
  expect(validateGuardian({ ...draft, name: '   ' })).toBe('Enter a guardian name.');
  expect(validateGuardian({ ...draft, guardianClass: null })).toBe('Choose a class.');
  expect(validateGuardian({ ...draft, strokes: [] })).toBe('Draw some guardian art.');
  expect(validateGuardian({ ...draft, strokes: [{ color: '#000000', points: [] }] })).toBe('Draw some guardian art.');
  expect(validateGuardian({ ...draft, name: 'a'.repeat(151) })).toContain('150');
  expect(() => createGuardian({ ...draft, name: '' })).toThrow('Enter a guardian name.');
});

test('creates a trimmed, independent snapshot of the drawing', () => {
  const guardian = createGuardian(draft);
  expect(guardian.name).toBe('Moss Knight');
  expect(guardian.guardianClass).toBe('Warrior');
  expect(guardian.strokes).toEqual(draft.strokes);
  expect(guardian.strokes).not.toBe(draft.strokes);
  expect(guardian.strokes[0].points[0]).not.toBe(draft.strokes[0].points[0]);
});

test('keeps drawing coordinates consistent across canvas sizes and clamps outside strokes', () => {
  expect(drawingPoint(75, 150, 300)).toEqual(drawingPoint(150, 300, 600));
  expect(drawingPoint(-20, 400, 300)).toEqual({ x: 0, y: 300 });
});
