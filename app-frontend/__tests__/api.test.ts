import { apiBaseUrl, apiRequest, ApiError } from '../src/api';
import { saveGuardian, listGuardians } from '../src/guardians/guardianApi';

afterEach(() => jest.restoreAllMocks());

test('sends guardian data and authorization, and loads the saved list', async () => {
  const guardian = { name: 'Moss', guardianClass: 'Mage' as const, strokes: [{ color: '#000000', points: [{ x: 20, y: 30 }] }] };
  const saved = { ...guardian, id: 'guardian-id' };
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => saved } as Response);
  expect(await saveGuardian('token', guardian)).toEqual(saved);
  expect(fetch).toHaveBeenCalledWith(`${apiBaseUrl}/guardians`, expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' }, body: JSON.stringify(guardian),
  }));
  await listGuardians('token');
  expect(fetch).toHaveBeenLastCalledWith(`${apiBaseUrl}/guardians`, expect.objectContaining({ method: 'GET' }));
});

test('preserves API status and message so expired sessions and validation errors can be handled', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Please sign in again.' }) } as Response);
  await expect(apiRequest('/guardians', 'expired')).rejects.toEqual(new ApiError('Please sign in again.', 401));
});
