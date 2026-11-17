import { apiRequest } from '../api';
import type { Guardian } from './guardian';

export interface SavedGuardian extends Guardian {
  id: string;
  artUrl: string;
  createdAt: string;
}

export const listGuardians = (token: string) => apiRequest<SavedGuardian[]>('/guardians', token);
export const saveGuardian = (token: string, guardian: Guardian) =>
  apiRequest<SavedGuardian>('/guardians', token, guardian);
