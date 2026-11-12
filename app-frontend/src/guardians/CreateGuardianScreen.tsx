import { useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import GuardianDrawing, { GuardianArtwork } from './GuardianDrawing';
import { createGuardian, GUARDIAN_CLASSES, validateGuardian, type DrawingStroke, type Guardian, type GuardianClass } from './guardian';

const CLASS_COLORS: Record<GuardianClass, string> = {
  Warrior: '#963d45', Brawler: '#925027', Ranger: '#326448', Mage: '#69469b',
};
const PALETTE = [
  { name: 'Black', color: '#000000' },
  { name: 'Red', color: '#d32f2f' },
  { name: 'Blue', color: '#1976d2' },
  { name: 'Green', color: '#388e3c' },
];

/** Creates and previews a guardian in memory. */
export default function CreateGuardianScreen({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [guardianClass, setGuardianClass] = useState<GuardianClass | null>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [brush, setBrush] = useState(PALETTE[0].color);
  const [error, setError] = useState<string | null>(null);
  const [guardian, setGuardian] = useState<Guardian | null>(null);

  function reset() {
    setName('');
    setGuardianClass(null);
    setStrokes([]);
    setBrush(PALETTE[0].color);
    setError(null);
    setGuardian(null);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <Button title="Back to login" onPress={onClose} />
        <Text accessibilityRole="header" style={styles.title}>{guardian ? 'Guardian created' : 'Create a guardian'}</Text>
        <Text style={styles.notice}>Local demo: your guardian resets when you leave this screen or refresh.</Text>
        {guardian ? (
          <>
            <View style={[styles.card, { backgroundColor: CLASS_COLORS[guardian.guardianClass] }]}>
              <Text style={styles.cardName}>{guardian.name}</Text>
              <View style={styles.previewArt} accessibilityRole="image" accessibilityLabel={`Artwork for ${guardian.name}`}>
                <GuardianArtwork strokes={guardian.strokes} />
              </View>
              <Text style={styles.cardClass}>{guardian.guardianClass}</Text>
            </View>
            <Button title="Create another guardian" onPress={reset} />
          </>
        ) : (
          <>
            <Text style={styles.label}>Guardian name</Text>
            <TextInput accessibilityLabel="Guardian name" placeholder="Name your guardian" value={name}
              maxLength={150} style={styles.input} onChangeText={value => { setName(value); setError(null); }} />

            <Text style={styles.label}>Class</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Guardian class" style={styles.options}>
              {GUARDIAN_CLASSES.map(option => (
                <Pressable key={option} accessibilityRole="radio" accessibilityLabel={option}
                  accessibilityState={{ checked: guardianClass === option }}
                  onPress={() => { setGuardianClass(option); setError(null); }}
                  style={[styles.classOption, guardianClass === option && { backgroundColor: CLASS_COLORS[option] }]}>
                  <Text style={[styles.optionText, guardianClass === option && styles.selectedText]}>{option}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Art</Text>
            <Text style={styles.help}>Draw directly on the white area.</Text>
            <GuardianDrawing strokes={strokes} color={brush} onChange={value => { setStrokes(value); setError(null); }} />
            <View style={styles.options}>
              {PALETTE.map(color => (
                <Pressable key={color.name} accessibilityRole="button" accessibilityLabel={`${color.name} brush`}
                  accessibilityState={{ selected: brush === color.color }} onPress={() => setBrush(color.color)}
                  style={[styles.swatch, brush === color.color && styles.selectedSwatch]}>
                  <View style={[styles.swatchColor, { backgroundColor: color.color }]} />
                </Pressable>
              ))}
            </View>
            <View style={styles.options}>
              <Button title="Undo" disabled={!strokes.length} onPress={() => setStrokes(value => value.slice(0, -1))} />
              <Button title="Clear art" disabled={!strokes.length} onPress={() => setStrokes([])} />
            </View>
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Button title="Create guardian" onPress={() => {
              const draft = { name, guardianClass, strokes };
              const problem = validateGuardian(draft);
              setError(problem);
              if (!problem) setGuardian(createGuardian(draft));
            }} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: { alignItems: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 420, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 8, color: '#222222' },
  notice: { fontSize: 14, lineHeight: 20, color: '#555555' },
  label: { fontSize: 16, fontWeight: '600', color: '#222222' },
  input: { borderWidth: 1, borderColor: '#777777', borderRadius: 6, padding: 12, minHeight: 48, fontSize: 16, color: '#222222' },
  help: { fontSize: 14, color: '#555555' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  classOption: { borderWidth: 1, borderColor: '#777777', borderRadius: 6, padding: 10, minHeight: 44, justifyContent: 'center' },
  optionText: { fontSize: 15, color: '#222222' },
  selectedText: { color: '#ffffff', fontWeight: '700' },
  swatch: { width: 44, height: 44, borderWidth: 1, borderColor: '#777777', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  selectedSwatch: { borderWidth: 3, borderColor: '#1976d2' },
  swatchColor: { width: 28, height: 28, borderRadius: 14 },
  error: { color: '#b3261e', lineHeight: 22 },
  card: { padding: 16, borderRadius: 12, gap: 16 },
  cardName: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: '#ffffff' },
  previewArt: { width: '100%', aspectRatio: 1, backgroundColor: '#ffffff' },
  cardClass: { fontSize: 20, fontWeight: '600', textAlign: 'center', color: '#ffffff' },
});
