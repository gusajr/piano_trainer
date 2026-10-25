import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { usePracticeStore, PracticeMode } from '../store/practiceStore';
import { Note } from '@tonaljs/tonal';
import { playNote, playSequence } from '../services/audioEngine';
import Staff from '../components/Staff';
import PianoKeyboard from '../components/PianoKeyboard';
import SongTheoryPanel from '../components/SongTheoryPanel';
import FragmentPlayer from '../components/FragmentPlayer';
import { practiceChord, evaluateChordProgress } from '../services/practiceChord';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Progress bar ──────────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;
  return (
    <View style={progress.wrapper}>
      <View style={[progress.fill, { width: `${pct}%` as any }]} />
      <Text style={progress.label}>
        {current + 1} / {total}
      </Text>
    </View>
  );
}
const progress = StyleSheet.create({
  wrapper: {
    height: 6,
    backgroundColor: '#252535',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
    position: 'relative',
  },
  fill: { height: 6, backgroundColor: '#BB86FC', borderRadius: 3 },
  label: { display: 'none' },
});

// ─── Score summary ─────────────────────────────────────────────────────────
function ScoreSummary({
  answers,
  total,
  onRepeat,
  onAnalysis,
}: {
  answers: boolean[];
  total: number;
  onRepeat: () => void;
  onAnalysis: () => void;
}) {
  const correct = answers.filter(Boolean).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const emoji = pct === 100 ? '🎉' : pct >= 70 ? '👍' : '💪';

  return (
    <View style={summary.container}>
      <Text style={summary.emoji}>{emoji}</Text>
      <Text style={summary.title}>¡Fragmento completado!</Text>
      <Text style={summary.score}>
        {correct}/{total} notas correctas al primer intento — {pct}%
      </Text>
      <View style={summary.row}>
        <TouchableOpacity style={summary.btn} onPress={onRepeat}>
          <Text style={summary.btnText}>↺  Repetir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[summary.btn, summary.btnPrimary]}
          onPress={onAnalysis}
        >
          <Text style={[summary.btnText, summary.btnTextPrimary]}>
            🔍  Ver análisis
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const summary = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 64, marginBottom: 12 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#E0E0E0',
    marginBottom: 8,
  },
  score: { fontSize: 16, color: '#BB86FC', marginBottom: 32 },
  row: { flexDirection: 'row', gap: 12 },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#252535',
    borderWidth: 1,
    borderColor: '#444',
  },
  btnPrimary: { backgroundColor: '#BB86FC', borderColor: '#BB86FC' },
  btnText: { color: '#E0E0E0', fontWeight: '700', fontSize: 15 },
  btnTextPrimary: { color: '#0D0D14' },
});

// ─── Main Practice Screen ──────────────────────────────────────────────────

export default function PracticeScreen() {
  const {
    midiData,
    segmentNotes,
    currentNoteIndex,
    answers,
    practiceMode,
    activeHand,
    setPracticeMode,
    startMeasure,
    measureCount,
    resetSession,
  } = usePracticeStore();

  const [pressedNotes, setPressedNotes] = useState<string[]>([]);
  const heldNotes = useRef(new Set<number>());
  const playedNotes = useRef(new Set<number>());
  const progressTarget = useRef<typeof segmentNotes[number] | undefined>(undefined);
  const acceptedChord = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [revealedMode, setRevealedMode] = useState(false); // for Mode B: reveal staff

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, [segmentNotes, practiceMode]);
  const isFinished = currentNoteIndex >= segmentNotes.length && segmentNotes.length > 0;
  const currentNote = segmentNotes[currentNoteIndex];
  const currentChord = practiceChord(segmentNotes, currentNoteIndex);
  const clef = activeHand === 'left' ? 'bass' : 'treble';

  // ── Playback ──────────────────────────────────────────────────────────────
  const handlePlayFragment = useCallback(async () => {
    if (!midiData || segmentNotes.length === 0) return;
    const tempo = midiData.tempo;
    // Normalize times so segment starts at 0
    const startTime = segmentNotes[0].time;
    const normalized = segmentNotes.map((n) => ({
      name: n.name,
      time: n.time - startTime,
      duration: n.duration,
    }));
    await playSequence(normalized, tempo);
  }, [midiData, segmentNotes]);

  // ── Note press ─────────────────────────────────────────────────────────────
  const handleNoteDown = useCallback(
    (pressedNoteName: string) => {
      // Read current state synchronously: rapid taps and audio loading cannot score a stale note.
      const session = usePracticeStore.getState();
      const target = practiceChord(session.segmentNotes, session.currentNoteIndex);
      const pitch = Note.midi(pressedNoteName);
      if (!target.length || pitch === null || heldNotes.current.has(pitch)) return;
      if (progressTarget.current !== target[0]) {
        playedNotes.current.clear();
        progressTarget.current = target[0];
        acceptedChord.current = null;
      }
      heldNotes.current.add(pitch);
      setPressedNotes([...heldNotes.current].map((midi) => Note.fromMidiSharps(midi)));
      void playNote(pressedNoteName).catch(console.error);
      if (acceptedChord.current !== null) return;
      if (target.some((note) => note.midi === pitch)) playedNotes.current.add(pitch);
      const result = evaluateChordProgress(target, heldNotes.current, playedNotes.current);
      if (result === 'wrong') session.recordChordAnswer(false);
      if (result === 'correct') acceptedChord.current = session.currentNoteIndex;
      setFeedback(result === 'waiting' ? null : result === 'correct' ? 'correct' : 'wrong');
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => {
        setFeedback(null);
      }, result === 'correct' ? 500 : 700);
    },
    [],
  );
  const handleNoteUp = useCallback((name: string) => {
    const pitch = Note.midi(name);
    if (pitch !== null) heldNotes.current.delete(pitch);
    setPressedNotes([...heldNotes.current].map((midi) => Note.fromMidiSharps(midi)));
    if (acceptedChord.current === null) {
      const session = usePracticeStore.getState();
      if (evaluateChordProgress(practiceChord(session.segmentNotes, session.currentNoteIndex), heldNotes.current, playedNotes.current) === 'correct') {
        acceptedChord.current = session.currentNoteIndex;
        setFeedback('correct');
      }
    }
    // Keep the same keyboard window until all fingers are lifted, so a chord
    // crossing octaves cannot remount keys under fingers that are still down.
    if (!heldNotes.current.size && acceptedChord.current !== null) {
      const session = usePracticeStore.getState();
      if (session.currentNoteIndex === acceptedChord.current) session.recordChordAnswer(true);
      acceptedChord.current = null;
      playedNotes.current.clear();
    }
  }, []);

  // ── Mode B: reveal ─────────────────────────────────────────────────────────
  const handleRevealModeB = () => setRevealedMode(true);

  if (!midiData || segmentNotes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          No hay notas en este segmento.{'\n'}Vuelve atrás y elige otro.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Finished screen ──────────────────────────────────────────────────────
  if (isFinished) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
        <ScoreSummary
          answers={answers}
          total={segmentNotes.length}
          onRepeat={() => {
            resetSession();
            setRevealedMode(false);
            setFeedback(null);
            heldNotes.current.clear();
            playedNotes.current.clear();
            acceptedChord.current = null;
            setPressedNotes([]);
          }}
          onAnalysis={() => router.push('/analysis')}
        />
        <FragmentPlayer />
        <SongTheoryPanel midi={midiData} startMeasure={startMeasure} measureCount={measureCount} initialScope="selection" />
      </ScrollView>
    );
  }

  // ── Practice screen ──────────────────────────────────────────────────────
  const showStaffLabels = practiceMode === 'A' || revealedMode;

  return (
    <View style={styles.screen}>
      {/* ── Mode toggle ── */}
      <View style={styles.modeRow}>
        {(['A', 'B'] as PracticeMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, practiceMode === m && styles.modeBtnActive]}
            onPress={() => {
              setPracticeMode(m);
              setFeedback(null);
              heldNotes.current.clear();
              playedNotes.current.clear();
              acceptedChord.current = null;
              setPressedNotes([]);
              setRevealedMode(false);
            }}
          >
            <Text
              style={[
                styles.modeBtnText,
                practiceMode === m && styles.modeBtnTextActive,
              ]}
            >
              {m === 'A' ? '👁️ Ver y tocar' : '👂 Escuchar y adivinar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ── Progress ── */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            Nota {currentNoteIndex + 1} de {segmentNotes.length}
          </Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <ProgressBar
              current={currentNoteIndex}
              total={segmentNotes.length}
            />
          </View>
        </View>

        {/* ── Staff ── */}
        <View style={styles.staffWrapper}>
          <Staff
            notes={segmentNotes}
            currentNoteIndex={currentNoteIndex}
            currentNoteIndices={currentChord.map((_, offset) => currentNoteIndex + offset)}
            clef={clef}
            width={SCREEN_W - 32}
            showNoteNames={showStaffLabels}
          />
        </View>

        {/* ── Playback & Mode B controls ── */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.playBtn} onPress={handlePlayFragment}>
            <Text style={styles.playBtnText}>▶  Escuchar</Text>
          </TouchableOpacity>

          {practiceMode === 'B' && !revealedMode && (
            <TouchableOpacity
              style={styles.revealBtn}
              onPress={handleRevealModeB}
            >
              <Text style={styles.revealBtnText}>👁️ Revelar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Current note hint (Mode A) ── */}
        {practiceMode === 'A' && currentNote && (
          <View
            style={[
              styles.noteHint,
              feedback === 'correct' && styles.noteHintCorrect,
              feedback === 'wrong' && styles.noteHintWrong,
            ]}
          >
            <Text style={styles.noteHintLabel}>{currentChord.length > 1 ? 'Toca estas notas juntas o por separado:' : 'Toca esta nota:'}</Text>
            <Text style={[styles.noteHintName, currentChord.length > 1 && { fontSize: 30 }]}>{currentChord.map((n) => n.name).join(' + ')}</Text>
            {feedback && (
              <Text style={styles.noteHintFeedback}>
                {feedback === 'correct' ? '✅ ¡Correcto!' : '❌ Incorrecto — Inténtalo de nuevo'}
              </Text>
            )}
          </View>
        )}

        {/* ── Mode B: question ── */}
        {practiceMode === 'B' && !revealedMode && (
          <View style={styles.noteHint}>
            <Text style={styles.noteHintLabel}>
              Escucha el fragmento y toca las notas de memoria
            </Text>
            <Text style={[styles.noteHintName, { fontSize: 28 }]}>❓</Text>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Piano keyboard ── */}
      <View style={styles.keyboardWrapper}>
        <PianoKeyboard
          onNotePress={(name) => { handleNoteDown(name); handleNoteUp(name); }}
          onNoteDown={handleNoteDown}
          onNoteUp={handleNoteUp}
          correctNote={
            practiceMode === 'A' && currentNote ? currentNote.name : null
          }
          correctNotes={practiceMode === 'A' ? currentChord.map((n) => Note.fromMidiSharps(n.midi)) : []}
          rangeNotes={currentChord.map((n) => Note.fromMidiSharps(n.midi))}
          pressedNotes={pressedNotes}
        />
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0D0D14' },
  centered: {
    flex: 1,
    backgroundColor: '#0D0D14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: '#252535',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtnText: { color: '#BB86FC', fontWeight: '700' },

  modeRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 6,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#252535',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#252535',
  },
  modeBtnActive: { backgroundColor: '#BB86FC22', borderWidth: 1, borderColor: '#BB86FC' },
  modeBtnText: { color: '#888', fontSize: 12, fontWeight: '600' },
  modeBtnTextActive: { color: '#BB86FC' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: { color: '#888', fontSize: 12 },

  staffWrapper: {
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },

  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  playBtn: {
    flex: 1,
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BB86FC55',
  },
  playBtnText: { color: '#BB86FC', fontWeight: '700', fontSize: 14 },
  revealBtn: {
    paddingHorizontal: 20,
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#03DAC6',
  },
  revealBtnText: { color: '#03DAC6', fontWeight: '700', fontSize: 14 },
  theoryToggleBtn: {
    paddingHorizontal: 16,
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4DB6AC44',
  },
  theoryToggleBtnActive: {
    borderColor: '#03DAC6',
    backgroundColor: '#002B28',
  },
  theoryToggleText: {
    color: '#80CBC4',
    fontWeight: '700',
    fontSize: 13,
  },
  theoryToggleTextActive: {
    color: '#03DAC6',
  },
  liveTheoryWrapper: {
    marginBottom: 12,
  },

  noteHint: {
    backgroundColor: '#1A1330',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BB86FC33',
  },
  noteHintCorrect: { borderColor: '#03DAC6', backgroundColor: '#00312E' },
  noteHintWrong: { borderColor: '#CF6679', backgroundColor: '#3B0D18' },
  noteHintLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  noteHintName: {
    fontSize: 44,
    fontWeight: '900',
    color: '#BB86FC',
    letterSpacing: 2,
  },
  noteHintFeedback: { color: '#E0E0E0', fontSize: 15, marginTop: 6 },

  keyboardWrapper: {
    backgroundColor: '#0D0D14',
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#252535',
  },
});
