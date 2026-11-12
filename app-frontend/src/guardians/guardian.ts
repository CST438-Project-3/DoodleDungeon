export const GUARDIAN_CLASSES = ['Warrior', 'Brawler', 'Ranger', 'Mage'] as const;
export type GuardianClass = typeof GUARDIAN_CLASSES[number];

export interface DrawingPoint {
  x: number;
  y: number;
}
export interface DrawingStroke {
  color: string;
  points: DrawingPoint[];
}

export interface GuardianDraft {
  name: string;
  guardianClass: GuardianClass | null;
  strokes: DrawingStroke[];
}

export interface Guardian {
  name: string;
  guardianClass: GuardianClass;
  strokes: DrawingStroke[];
}


export function drawingPoint(x: number, y: number, size: number): DrawingPoint {
  const coordinate = (value: number) =>
    Math.round(Math.max(0, Math.min(300, value / size * 300)) * 10) / 10;
  return { x: coordinate(x), y: coordinate(y) };
}


export function validateGuardian(draft: GuardianDraft): string | null {
  if (!draft.name.trim()) return 'Enter a guardian name.';
  if (draft.name.trim().length > 150) return 'Keep the name to 150 characters or fewer.';
  if (!draft.guardianClass || !GUARDIAN_CLASSES.includes(draft.guardianClass)) return 'Choose a class.';
  if (!draft.strokes.some(stroke => stroke.points.length > 0)) return 'Draw some guardian art.';
  return null;
}


export function createGuardian(draft: GuardianDraft): Guardian {
  const error = validateGuardian(draft);
  if (error) throw new Error(error);
  return {
    name: draft.name.trim(),
    guardianClass: draft.guardianClass!,
    strokes: draft.strokes.map(stroke => ({
      color: stroke.color,
      points: stroke.points.map(point => ({ ...point })),
    })),
  };
}
