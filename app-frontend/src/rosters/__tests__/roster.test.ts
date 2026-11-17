import { createRosterClient, RosterMember } from '../roster';

const rosterId = '550e8400-e29b-41d4-a716-446655440000';
const roster = { rosterId, userId: 'c56a4180-65aa-42ec-a945-5fd21dec0538', members: [{ name: 'Oak' }] };
const client = createRosterClient('http://localhost:8080/api/');

describe('roster requests', () => {
  // Expectations come from docs/openapi.yaml: bearer authentication, UUID paths,
  // member-only request bodies, returned roster objects, and a bodyless 204 delete.
  afterEach(() => jest.restoreAllMocks());

  it('lists rosters with the session token and preserves generic guardian fields', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => [roster],
    } as Response);
    expect(await client.list('test-session')).toEqual([roster]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/user/rosters', {
      method: 'GET', headers: { Authorization: 'Bearer test-session', Accept: 'application/json' },
    });
  });

  it.each([
    ['create', 'POST', ''],
    ['replace', 'PUT', `/${rosterId}`],
    ['updateMembers', 'PATCH', `/${rosterId}`],
  ] as const)('sends the member selection through %s', async (operation, method, path) => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => roster,
    } as Response);
    const result = operation === 'create'
      ? await client.create('test-session', roster.members)
      : await client[operation]('test-session', roster.rosterId, roster.members);
    expect(result).toEqual(roster);
    expect(fetchMock).toHaveBeenCalledWith(`http://localhost:8080/api/user/rosters${path}`,
      expect.objectContaining({ method, body: JSON.stringify({ members: roster.members }),
        headers: expect.objectContaining({ Authorization: 'Bearer test-session', 'Content-Type': 'application/json' }),
      }));
  });

  it('deletes without trying to parse a 204 response body', async () => {
    const json = jest.fn();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 204, json } as unknown as Response);
    await expect(client.remove('test-session', rosterId)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`http://localhost:8080/api/user/rosters/${rosterId}`,
      expect.objectContaining({ method: 'DELETE' }));
    expect(json).not.toHaveBeenCalled();
  });

  it('requires a session for every roster operation before sending any request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(client.list('')).rejects.toMatchObject({ status: 401 });
    await expect(client.create('', [])).rejects.toMatchObject({ status: 401 });
    await expect(client.replace('', rosterId, [])).rejects.toMatchObject({ status: 401 });
    await expect(client.updateMembers('', rosterId, [])).rejects.toMatchObject({ status: 401 });
    await expect(client.remove('', rosterId)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['../users/me', '?owner=someone-else', "' OR 1=1 --", '<script>alert(1)</script>'])
  ('rejects invalid roster IDs before making a request: %s', async id => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(client.remove('test-session', id)).rejects.toMatchObject({ status: 400 });
    await expect(client.replace('test-session', id, [])).rejects.toMatchObject({ status: 400 });
    await expect(client.updateMembers('test-session', id, [])).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serializes hostile-looking member text as JSON data without adding request fields', async () => {
    // This proves quotes cannot escape a JSON field during transport. It does NOT prove
    // SQL-injection resistance: that needs real repository tests with bound SQL parameters.
    const members = [{ name: "'); DROP TABLE rosters; --", note: '\"},\"userId\":\"other-user' }];
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 201, json: async () => ({ ...roster, members }),
    } as Response);
    await client.create('test-session', members);
    const body = fetchMock.mock.calls[0][1]?.body as string;
    expect(JSON.parse(body)).toEqual({ members });
    expect(JSON.parse(body)).not.toHaveProperty('userId');
  });

  it.each([null, 'not an array', [null], ['guardian'], [[]]].map(members => [members]))
  ('rejects malformed member payloads without a request: %j', async members => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(client.create('test-session', members as unknown as RosterMember[]))
      .rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 500])('reports HTTP %s as a failed request', async status => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status } as Response);
    await expect(client.list('test-session')).rejects.toMatchObject({ status });
  });

  it('reports a network failure', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(client.list('test-session')).rejects.toThrow('Unable to reach the server');
  });

  it('rejects malformed roster data before the screen tries to render it', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => [{ ...roster, members: [null] }],
    } as Response);
    await expect(client.list('test-session')).rejects.toThrow('invalid roster');
  });
});
