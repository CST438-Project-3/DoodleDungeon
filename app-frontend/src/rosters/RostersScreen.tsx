import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Roster, RosterClient, rosterClient } from './roster';

interface Props {
  // App.tsx passes the token returned by sign-in. Null means there is no session yet.
  token: string | null;
  // The parent decides which screen to show after Back; this component does not own navigation.
  onClose: () => void;
  // Optional: tests can supply fake responses. Normal app usage defaults to the real HTTP client.
  client?: RosterClient;
}

export default function RostersScreen({ token, onClose, client = rosterClient }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text accessibilityRole="header" style={styles.heading}>My rosters</Text>
      <Button title="Back" onPress={onClose} />
      {token?.trim() ? (
        // Optional chaining (?.) skips trim when token is null. This controls which UI to show;
        // it does not validate the token's signature or replace authorization on the server.
        // React treats a changed key as a new component and discards the old component's state.
        // This prevents a different session from briefly showing the previous user's rosters.
        <SignedInRosters key={token} token={token} client={client} />
      ) : (
        <Text style={styles.message}>Sign in to view and manage your rosters.</Text>
      )}
    </ScrollView>
  );
}

function SignedInRosters({ token, client }: { token: string; client: RosterClient }) {
  // useState keeps values between renders. Calling the setter tells React to redraw the screen.
  // Roster[] describes an array of the response type defined in roster.ts.
  const [rosters, setRosters] = useState<Roster[]>([]);
  // Loading is for GET requests; saving is for changes. Both disable buttons to avoid overlap.
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  // Store IDs rather than array positions, since refreshes or deletions can reorder the list.
  // selectedId controls the expanded member list; deleteId controls the confirmation prompt.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const busy = loading || saving;

  // Effects run after rendering. This fetches on opening the screen and whenever a dependency
  // below changes. Incrementing reload is how the Refresh button requests another fetch.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    client.list(token)
      .then(result => {
        if (active) {
          setRosters(result);
          setDeleteId(null);
          // Keep the open roster only if it still exists in the latest server response.
          setSelectedId(previous => result.some(roster => roster.rosterId === previous) ? previous : null);
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      })
      .finally(() => { if (active) setLoading(false); });
    // React runs this cleanup before the next effect or when the screen closes. It does not
    // cancel the HTTP request; it stops an old response from replacing the current screen state.
    return () => { active = false; };
  }, [client, token, reload]);

  async function createRoster() {
    setSaving(true);
    setError(null);
    try {
      // Empty rosters are allowed by the contract. Guardian selection can later supply members here.
      // TODO: Open a member picker and pass its selected guardian objects in place of [].
      const created = await client.create(token, []);
      // Use the server's response because it contains the assigned roster ID and owner ID.
      // The updater receives the latest list; spreading it creates a new array instead of mutating it.
      setRosters(previous => [...previous, created]);
      setSelectedId(created.rosterId);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      // finally runs on success and failure, so buttons become usable again either way.
      setSaving(false);
    }
  }

  async function deleteRoster(id: string) {
    setSaving(true);
    setError(null);
    try {
      // Wait for confirmation from the server before removing the card. A failed delete leaves
      // the roster visible and shows an error, so the user can retry instead of losing their place.
      await client.remove(token, id);
      setRosters(previous => previous.filter(roster => roster.rosterId !== id));
      setSelectedId(previous => previous === id ? null : previous);
      setDeleteId(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.subheading}>Roster options</Text>
      <View style={styles.actions}>
        <Button title="Refresh rosters" disabled={busy} onPress={() => setReload(previous => previous + 1)} />
        {/* onPress expects an event handler. void discards the returned Promise; createRoster
            handles its own errors and updates the screen when the request finishes. */}
        <Button title="Create empty roster" disabled={busy} onPress={() => { void createRoster(); }} />
      </View>
      {loading && <ActivityIndicator accessibilityLabel="Loading rosters" />}
      {saving && <Text>Saving changes…</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {/* && conditionally renders the message. Show "no rosters" only after a successful load;
          an unavailable server must not look like an empty account. */}
      {!loading && !error && rosters.length === 0 && <Text>You do not have any rosters yet.</Text>}
      {/* map turns each API response into a card. The UUID is React's stable key; the number
          in "Roster 1" is only a display label because the contract has no roster name field. */}
      {rosters.map((roster, index) => (
        <View key={roster.rosterId} style={styles.card}>
          <Text accessibilityRole="header" style={styles.subheading}>Roster {index + 1}</Text>
          <Text selectable>ID: {roster.rosterId}</Text>
          <Text>{roster.members.length} guardians</Text>
          <View style={styles.actions}>
            <Button
              title={selectedId === roster.rosterId ? 'Hide members' : 'View members'}
              disabled={busy}
              onPress={() => setSelectedId(previous => previous === roster.rosterId ? null : roster.rosterId)}
            />
            <Button title="Delete roster" disabled={busy} onPress={() => setDeleteId(roster.rosterId)} />
          </View>
          {selectedId === roster.rosterId && (
            <View style={styles.section}>
              {/* TODO: Add guardian selection here. roster.ts exposes updateMembers (PATCH)
                  and replace (PUT); both take the complete desired member list. After saving,
                  replace the matching roster in state with the server's returned roster. */}
              {roster.members.length === 0 && <Text>This roster has no guardians yet.</Text>}
              {roster.members.map((member, memberIndex) => (
                // Guardian fields are unknown until the shared contract defines them. Check the
                // name's type before rendering it; otherwise display its position in the roster.
                // Switch to a stable guardian ID as the key when the contract guarantees one.
                // Keep user-supplied names inside Text: React renders them as text on web.
                // Do not turn these strings into HTML or evaluate them as code.
                <Text key={memberIndex}>
                  {memberIndex + 1}. {typeof member.name === 'string' && member.name.trim()
                    ? member.name : `Guardian ${memberIndex + 1}`}
                </Text>
              ))}
            </View>
          )}
          {deleteId === roster.rosterId && (
            <View style={styles.section}>
              {/* Setting deleteId opens this prompt. Only Confirm deletion sends the request;
                  Cancel clears the prompt without changing anything on the server. */}
              <Text>Delete this roster? This cannot be undone.</Text>
              <View style={styles.actions}>
                <Button title="Confirm deletion" disabled={busy} onPress={() => { void deleteRoster(roster.rosterId); }} />
                <Button title="Cancel deletion" disabled={busy} onPress={() => setDeleteId(null)} />
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function errorMessage(failure: unknown): string {
  // JavaScript can throw any value. Narrow unknown to Error before reading its message.
  return failure instanceof Error ? failure.message : 'Unable to load or save rosters. Please try again.';
}

const styles = StyleSheet.create({
  // Keep cards readable on a wide browser window while allowing a narrow phone layout.
  page: { padding: 24, gap: 16, width: '100%', maxWidth: 800, alignSelf: 'center' },
  heading: { fontSize: 28, fontWeight: 'bold' },
  subheading: { fontSize: 20, fontWeight: '600' },
  section: { gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 16, gap: 12 },
  message: { marginTop: 16 },
  error: { color: '#b3261e' },
});
