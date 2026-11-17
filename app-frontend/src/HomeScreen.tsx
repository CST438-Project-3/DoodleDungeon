import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from './api';
import CreateGuardianScreen from './guardians/CreateGuardianScreen';
import { GuardianArtwork } from './guardians/GuardianDrawing';
import { listGuardians, saveGuardian, type SavedGuardian } from './guardians/guardianApi';
import type { Guardian } from './guardians/guardian';

type Props = { token: string; displayName: string; onLogout: () => void; onSessionExpired: () => void };

export default function HomeScreen({ token, displayName, onLogout, onSessionExpired }: Props) {
  const [guardians, setGuardians] = useState<SavedGuardian[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGuardians(await listGuardians(token));
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 401) onSessionExpired();
      else setError('Unable to load guardians. Check that the API is running, then retry.');
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function create(guardian: Guardian) {
    try {
      const saved = await saveGuardian(token, guardian);
      setGuardians(current => [saved, ...current]);
      return saved;
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 401) onSessionExpired();
      throw problem;
    }
  }

  if (creating) return <CreateGuardianScreen onClose={() => setCreating(false)} onSave={create} />;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.brand}><Text style={styles.title} accessibilityRole="header">DoodleDungeon</Text>
          <Text style={styles.subtitle}>Welcome, {displayName}!</Text></View>
        <View style={styles.headerActions}>
          <Text style={styles.count}>{guardians.length} {guardians.length === 1 ? 'guardian' : 'guardians'}</Text>
          <Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.navLabel}>Log out</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.heading} accessibilityRole="header">Your guardians</Text>
        {loading && <ActivityIndicator accessibilityLabel="Loading guardians" />}
        {error && <View style={styles.message}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Button title="Retry" onPress={() => void refresh()} /></View>}
        {!loading && !error && guardians.length === 0 &&
          <View style={styles.empty}><Text style={styles.emptyTitle}>Your dungeon starts here</Text>
            <Text style={styles.subtitle}>Tap + below to draw and save your first guardian.</Text></View>}
        <View style={styles.cards}>
          {guardians.map(guardian => (
            <View style={styles.card} key={guardian.id}>
              <View style={styles.art} accessibilityRole="image" accessibilityLabel={`Artwork for ${guardian.name}`}>
                {guardian.strokes.length ? <GuardianArtwork strokes={guardian.strokes} />
                  : <Image source={{ uri: guardian.artUrl }} style={styles.art} />}
              </View>
              <Text style={styles.cardName}>{guardian.name || 'Unnamed guardian'}</Text>
              <Text style={styles.subtitle}>{guardian.guardianClass}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.navigation}>
        <View style={styles.navSlot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh home" onPress={() => void refresh()} style={styles.navButton}>
            <Text style={styles.navLabel}>Home</Text>
          </Pressable>
        </View>
        <View style={styles.navSlot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Create guardian" onPress={() => setCreating(true)} style={styles.addButton}>
            <Text style={styles.plus}>+</Text>
          </Pressable>
        </View>
        <View style={styles.navSlot}>
          <Pressable accessibilityRole="button" accessibilityLabel="My rosters (work in progress)"
            accessibilityState={{ disabled: true }} disabled style={[styles.navButton, styles.disabledButton]}>
            <Text style={styles.disabledLabel}>My rosters</Text>
            <Text style={styles.wipLabel}>WIP</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f1eb' },
  header: { paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#263a35' },
  subtitle: { fontSize: 15, color: '#52615a', lineHeight: 22 },
  brand: { flex: 1, marginRight: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoutButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#bac5bc', borderRadius: 8 },
  count: { color: '#263a35', fontWeight: '600' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 20, gap: 16 },
  heading: { fontSize: 20, fontWeight: '700', color: '#263a35' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { width: 180, backgroundColor: '#ffffff', padding: 12, borderRadius: 12, gap: 6 },
  art: { width: '100%', aspectRatio: 1, backgroundColor: '#ffffff' },
  cardName: { fontSize: 17, fontWeight: '700', color: '#263a35' },
  empty: { paddingVertical: 24, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '600', color: '#263a35' },
  message: { gap: 8, alignItems: 'flex-start' },
  error: { color: '#b3261e' },
  navigation: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#d8dfd9' },
  navSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { backgroundColor: '#eef0ed', borderRadius: 8, paddingHorizontal: 12 },
  disabledLabel: { color: '#7c877f', fontSize: 16, fontWeight: '600' },
  wipLabel: { color: '#7c877f', fontSize: 11, fontWeight: '700' },
  navButton: { minWidth: 100, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: '#263a35', fontSize: 16, fontWeight: '600' },
  addButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#315d4e', alignItems: 'center', justifyContent: 'center' },
  plus: { color: '#ffffff', fontSize: 34, lineHeight: 40 },
});
