import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { usePracticeStore } from '../store/practiceStore';
import SongTheoryPanel from '../components/SongTheoryPanel';
import Staff from '../components/Staff';
import FragmentPlayer from '../components/FragmentPlayer';

const { width: SCREEN_W } = Dimensions.get('window');

export default function AnalysisScreen() {
  const { segmentNotes, answers, activeHand, midiData, startMeasure, measureCount } = usePracticeStore();

  const clef = activeHand === 'left' ? 'bass' : 'treble';
  const correct = answers.filter(Boolean).length;
  const total = answers.length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <FragmentPlayer />
      {midiData && <SongTheoryPanel midi={midiData} startMeasure={startMeasure} measureCount={measureCount} />}

      {/* ── Score recap ── */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreTitle}>Resultado de la práctica</Text>
        <Text style={styles.scoreValue}>
          {total > 0 ? `${correct}/${total} notas correctas al primer intento` : 'Sin respuestas registradas'}
        </Text>
        {total > 0 && (
          <View style={styles.scoreBar}>
            <View
              style={[
                styles.scoreBarFill,
                { width: `${(correct / total) * 100}%` as any },
              ]}
            />
          </View>
        )}
      </View>

      {/* ── Full staff of segment ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notas del fragmento</Text>
        <View style={styles.staffWrapper}>
          <Staff
            notes={segmentNotes}
            currentNoteIndex={-1}   // no highlight
            clef={clef}
            width={SCREEN_W - 32}
            showNoteNames={true}
          />
        </View>
        {/* Note list */}
        <View style={styles.noteList}>
          {segmentNotes.map((note, i) => (
            <View
              key={i}
              style={[
                styles.noteChip,
                answers[i] === true && styles.noteChipCorrect,
                answers[i] === false && styles.noteChipWrong,
              ]}
            >
              <Text style={styles.noteChipText}>{note.name}</Text>
              {answers[i] !== undefined && (
                <Text style={styles.noteChipIcon}>
                  {answers[i] ? '✅' : '❌'}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* ── MIDI metadata ── */}
      {midiData && (
        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Info del MIDI</Text>
          <Text style={styles.metaRow}>🎵 Tempo: {Math.round(midiData.tempo)} BPM</Text>
          <Text style={styles.metaRow}>
            📊 Compás: {midiData.timeSignature[0]}/{midiData.timeSignature[1]}
          </Text>
          <Text style={styles.metaRow}>
            🎹 Tracks: {midiData.tracks.length}
          </Text>
          <Text style={styles.metaRow}>
            ⏱ Duración: {Math.round(midiData.durationSeconds)}s
          </Text>
        </View>
      )}

      {/* ── Actions ── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.actionBtnText}>← Volver a practicar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => router.push('/')}
        >
          <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
            🏠 Inicio
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0D0D14' },
  content: { padding: 16 },

  scoreCard: {
    backgroundColor: '#1A1330',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BB86FC33',
  },
  scoreTitle: { color: '#888', fontSize: 13, marginBottom: 6 },
  scoreValue: {
    color: '#BB86FC',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  scoreBar: {
    height: 6,
    backgroundColor: '#252535',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 6,
    backgroundColor: '#BB86FC',
    borderRadius: 3,
  },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E0E0E0',
    marginBottom: 10,
  },

  staffWrapper: {
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },

  noteList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  noteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#252535',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  noteChipCorrect: {
    backgroundColor: '#003B36',
    borderColor: '#03DAC6',
  },
  noteChipWrong: {
    backgroundColor: '#3B0D18',
    borderColor: '#CF6679',
  },
  noteChipText: { color: '#E0E0E0', fontWeight: '700', fontSize: 13 },
  noteChipIcon: { fontSize: 12 },

  metaCard: {
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  metaTitle: {
    color: '#BB86FC',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 8,
  },
  metaRow: { color: '#B0BEC5', fontSize: 13, marginBottom: 4 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#252535',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  actionBtnPrimary: {
    backgroundColor: '#BB86FC',
    borderColor: '#BB86FC',
  },
  actionBtnText: { color: '#E0E0E0', fontWeight: '700', fontSize: 14 },
  actionBtnTextPrimary: { color: '#0D0D14' },
});
