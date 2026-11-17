// The contract leaves guardian fields open until the shared guardian model is agreed on.
// Record<string, unknown> means an object with string keys whose values must be checked
// before use. Unlike any, unknown does not let us blindly call methods on a field.
export type RosterMember = Record<string, unknown>;

export interface Roster {
  rosterId: string;
  userId: string;
  members: RosterMember[];
}

export class RosterRequestError extends Error {
  // "public readonly" creates a status property from the constructor argument and prevents
  // reassignment in TypeScript. Keeping the HTTP status lets future UI distinguish login
  // failures (401) from missing rosters (404) without trying to parse the message text.
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'RosterRequestError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  // The "value is ..." return type is a type predicate: after a true result, TypeScript
  // lets the caller treat value as an object. JavaScript calls null and arrays "object",
  // so those need separate checks before treating a value as a guardian object.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Match the UUID format in OpenAPI. This is input validation, not authorization;
// the backend must still check that the signed-in user owns the requested roster.
function isUuid(value: unknown): value is string {
  // ^ and $ require the WHOLE string to match; {8}/{4}/{12} require each UUID group length.
  // [0-9a-f] permits hexadecimal digits, and /i also permits uppercase letters.
  // This checks syntax only: it does not prove an ID exists or belongs to this user.
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function readRoster(value: unknown): Roster {
  // A TypeScript interface cannot validate a server response. Check the actual JSON here
  // before the screen reads members.length or renders a card. every(isObject) checks each
  // member while allowing an empty list, as the current API contract does.
  if (!isObject(value) || !isUuid(value.rosterId)
    || !isUuid(value.userId) || !Array.isArray(value.members)
    || !value.members.every(isObject)) {
    throw new Error('The server returned an invalid roster. Please try again.');
  }
  return { rosterId: value.rosterId, userId: value.userId, members: value.members };
}

// A separate client lets the screen be tested without Google sign-in or a running server.
export function createRosterClient(
  baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080/api',
) {
  // The base URL is developer configuration. Do not allow a text field or query parameter
  // to choose this URL: requests include the session token and must go to our trusted API.
  // The factory's methods remember this URL through a JavaScript closure.
  const collectionUrl = `${baseUrl.replace(/\/+$/, '')}/user/rosters`;
  const itemPath = (id: string) => {
    // Reject paths, query strings, or arbitrary text before they can become part of a URL.
    if (!isUuid(id)) throw new RosterRequestError(400, 'A valid roster UUID is required.');
    // Encoding keeps an identifier in one URL segment. It does not make it safe to
    // concatenate into SQL later; the database repository must bind it as a parameter.
    return `/${encodeURIComponent(id)}`;
  };

  async function request(token: string, method: string, path = '', members?: RosterMember[]) {
    // An async function returns a Promise. await pauses this function until the request
    // finishes while allowing the UI to stay responsive. Throwing rejects that Promise,
    // which the screen catches to show an error and re-enable its buttons.
    // members? means the argument is optional: GET and DELETE have no member payload.
    if (!token.trim()) {
      throw new RosterRequestError(401, 'Sign in to manage your rosters.');
    }
    // TypeScript types disappear at runtime. Check the shape before sending editable data.
    if (['POST', 'PUT', 'PATCH'].includes(method)
      && (!Array.isArray(members) || !members.every(isObject))) {
      throw new RosterRequestError(400, 'Roster members must be a list of guardian objects.');
    }
    let response: Response;
    try {
      response = await fetch(`${collectionUrl}${path}`, {
        method,
        headers: {
          // Send the session in a header, never in the URL where it can enter history/logs.
          // Having a nonempty token is not proof of identity: the backend must verify it.
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          // Object spread (...), combined with the ternary, adds this header only when
          // sending a body. This avoids attaching JSON-body headers to a plain list request.
          ...(members !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        // Ownership comes from the session; never send a user ID supplied by the screen.
        // JSON.stringify keeps quotes and other characters inside data values. The server's
        // repository must separately use SQL parameters; JSON encoding cannot prevent SQL injection.
        ...(members !== undefined ? { body: JSON.stringify({ members }) } : {}),
      });
    } catch {
      throw new Error('Unable to reach the server. Please try again.');
    }
    if (!response.ok) {
      // fetch rejects for connection failures, but HTTP errors such as 401/500 still return
      // a Response. Handle them explicitly. Use our own messages instead of displaying raw
      // server error bodies, which could contain stack traces or untrusted markup.
      const messages: Record<number, string> = {
        400: 'The roster request was not accepted. Check your selection and try again.',
        401: 'Your session has expired or is invalid. Please sign in again.',
        403: 'You do not have permission to access this roster.',
        404: 'This roster is no longer available. Refresh your rosters.',
      };
      throw new RosterRequestError(response.status,
        messages[response.status] || 'Unable to complete the roster request. Please try again.');
    }
    // DELETE returns 204, so there is no JSON body to read.
    if (response.status === 204) return undefined;
    // Keep parsed data unknown until the caller validates it. "as Promise<unknown>" only
    // describes a TypeScript type; readRoster/list perform the actual runtime checks.
    return response.json() as Promise<unknown>;
  }

  return {
    async list(token: string): Promise<Roster[]> {
      const result = await request(token, 'GET');
      if (!Array.isArray(result)) throw new Error('The server returned an invalid roster list.');
      return result.map(readRoster);
    },
    async create(token: string, members: RosterMember[]): Promise<Roster> {
      return readRoster(await request(token, 'POST', '', members));
    },
    async replace(token: string, rosterId: string, members: RosterMember[]): Promise<Roster> {
      // PUT addresses a specific roster. The caller supplies the complete desired list.
      return readRoster(await request(token, 'PUT', itemPath(rosterId), members));
    },
    async updateMembers(token: string, rosterId: string, members: RosterMember[]): Promise<Roster> {
      // This contract's PATCH also takes the complete member list, not an incremental diff.
      return readRoster(await request(token, 'PATCH', itemPath(rosterId), members));
    },
    async remove(token: string, rosterId: string): Promise<void> {
      await request(token, 'DELETE', itemPath(rosterId));
    },
  };
}

// typeof gets the factory's function type; ReturnType extracts the object type it returns.
// Tests and screens can accept that same interface without duplicating all method signatures.
export type RosterClient = ReturnType<typeof createRosterClient>;
// One shared instance means the screen's effect dependency stays stable across renders.
export const rosterClient = createRosterClient();
