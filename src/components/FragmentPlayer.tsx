import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePracticeStore } from '../store/practiceStore';
import { buildPlaybackPlan, playbackFrame } from '../services/playbackTimeline';
import { startTrackedPlayback } from '../services/audioEngine';
import Staff from './Staff';

export default function FragmentPlayer() {
  const { segmentNotes, midiData, activeHand, startMeasure, measureCount, totalMeasures, trackAssignments, splitPoint } = usePracticeStore();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<{ status: 'idle' | 'loading' | 'playing' | 'stopped' | 'ended'; time: number }>({ status: 'idle', time: 0 });
  const [error, setError] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  const session = useRef(0);
  const plan = useMemo(() => buildPlaybackPlan(segmentNotes,
    midiData?.measures?.[startMeasure - 1]?.startTime,
    midiData?.measures?.[startMeasure + measureCount - 2]?.endTime ?? midiData?.durationSeconds,
  ), [segmentNotes, midiData, startMeasure, measureCount]);
  const cancel = useCallback(() => { session.current++; stopRef.current?.(); stopRef.current = null; }, []);
  useFocusEffect(useCallback(() => {
    if (!plan.notes.length) cancel();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        cancel();
        setView((v) => v.status === 'playing' || v.status === 'loading' ? { ...v, status: 'stopped' } : v);
      }
    });
    return () => {
      subscription.remove(); cancel();
      setView({ status: 'idle', time: 0 });
    };
  }, [cancel, plan]));

  const play = () => {
    cancel();
    const id = session.current;
    setError('');
    setView({ status: 'loading', time: 0 });
    stopRef.current = startTrackedPlayback(plan, {
      onProgress: (time) => { if (session.current === id) setView({ status: 'playing', time }); },
      onComplete: () => { if (session.current === id) setView({ status: 'ended', time: plan.duration }); },
      onError: () => {
        if (session.current !== id) return;
        cancel(); setView((v) => ({ ...v, status: 'stopped' }));
        setError('No se pudo iniciar el audio. Vuelve a intentarlo.');
      },
    });
  };
  const running = view.status === 'loading' || view.status === 'playing';
  const active = playbackFrame(plan.notes, view.time).activeIndices;
  const { upper, lower } = useMemo(() => {
    const isLeft = (note: (typeof plan.notes)[number]) => trackAssignments[note.trackIndex] === 'left'
      || (trackAssignments[note.trackIndex] === 'split' && note.midi < splitPoint);
    return { upper: activeHand === 'both' ? plan.notes.filter((n) => !isLeft(n)) : plan.notes,
      lower: activeHand === 'both' ? plan.notes.filter(isLeft) : [] };
  }, [plan, activeHand, trackAssignments, splitPoint]);
  const staffWidth = Math.max(220, Math.min(width - 58, 900));
  const time = view.status === 'idle' ? undefined : view.time;
  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  return <View style={styles.card}>
    <Text style={styles.title}>Escuchar y seguir el fragmento</Text>
    <Text style={styles.subtitle}>Mano {activeHand === 'both' ? 'izquierda y derecha' : activeHand === 'left' ? 'izquierda' : 'derecha'} · Compases {startMeasure}–{Math.min(totalMeasures, startMeasure + measureCount - 1)}</Text>
    <TouchableOpacity accessibilityRole="button" disabled={!plan.notes.length}
      style={styles.button} onPress={() => {
        if (running) { cancel(); setView((v) => ({ ...v, status: 'stopped' })); }
        else play();
      }}>
      <Text style={styles.buttonText}>{running ? '■ Detener reproducción' : view.status === 'idle' ? '▶ Escuchar fragmento estudiado' : '↺ Volver a escuchar desde el inicio'}</Text>
    </TouchableOpacity>
    <Text style={styles.subtitle}>{view.status === 'loading' ? 'Preparando audio…' : `${format(view.time)} / ${format(plan.duration)}`}
      {view.status === 'ended' ? ' · Reproducción completa' : view.status === 'playing' && active.length ? ` · ${active.map((i) => plan.notes[i].name).join(' · ')}` : ''}</Text>
    {upper.length > 0 && <Staff notes={upper} currentNoteIndex={-1} clef={activeHand === 'left' ? 'bass' : 'treble'} width={staffWidth} playbackTime={time} playbackActive={view.status === 'playing'} />}
    {lower.length > 0 && <Staff notes={lower} currentNoteIndex={-1} clef="bass" width={staffWidth} playbackTime={time} playbackActive={view.status === 'playing'} />}
    <Text style={styles.subtitle}>Verde: notas que suenan · Morado: notas reproducidas. El pentagrama avanza automáticamente hacia la derecha.</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 12, marginVertical: 12, backgroundColor: '#1A1330', borderRadius: 14 },
  title: { fontSize: 17, color: '#BB86FC', fontWeight: '800' },
  subtitle: { color: '#B0B0C4', fontSize: 12, lineHeight: 18 },
  button: { minHeight: 48, backgroundColor: '#4F3374', borderRadius: 10, justifyContent: 'center', alignItems: 'center', padding: 12 },
  buttonText: { color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  error: { color: '#FF8A80', fontSize: 13 },
});
