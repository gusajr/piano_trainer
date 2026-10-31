import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ParsedTrack, HandAssignment, usePracticeStore } from '../store/practiceStore';
import { startTrackedPlayback } from '../services/audioEngine';
import { buildPlaybackPlan } from '../services/playbackTimeline';
import { Note } from '@tonaljs/tonal';

interface HandPickerProps {
  tracks: ParsedTrack[];
}

const HAND_OPTIONS: { label: string; value: HandAssignment; emoji: string }[] = [
  { label: 'Derecha', value: 'right', emoji: '🤚' },
  { label: 'Izquierda', value: 'left', emoji: '🫱' },
  { label: 'Dividir', value: 'split', emoji: '↔' },
  { label: 'Ignorar', value: 'none', emoji: '✕' },
];

const HAND_COLORS: Record<HandAssignment, string> = {
  right: '#BB86FC',
  left: '#03DAC6',
  split: '#64B5F6',
  none: '#555',
};

export default function HandPicker({ tracks }: HandPickerProps) {
  const { trackAssignments, setTrackAssignment, splitPoint, setSplitPoint } = usePracticeStore();
  const [playingTrackIndex, setPlayingTrackIndex] = useState<number | null>(null);
  const playing = useRef<number | null>(null);
  const stopPreview = useRef<(() => void) | null>(null);
  const cancel = useCallback(() => {
    stopPreview.current?.(); stopPreview.current = null;
    playing.current = null; setPlayingTrackIndex(null);
  }, []);
  useEffect(() => () => cancel(), [cancel, tracks]);
  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
    return () => { subscription.remove(); cancel(); };
  }, [cancel]));

  const handlePreviewTrack = (track: ParsedTrack) => {
    const wasPlaying = playing.current === track.index;
    cancel();
    if (wasPlaying || !track.notes.length) return;
    playing.current = track.index;
    setPlayingTrackIndex(track.index);
    stopPreview.current = startTrackedPlayback(buildPlaybackPlan(track.notes), {
      loop: true, onProgress: () => {}, onComplete: () => {},
      onStop: () => { playing.current = null; setPlayingTrackIndex(null); },
      onError: (error) => { console.error(error); cancel(); },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎹 Asignar Tracks a Mano</Text>
      <Text style={styles.subtitle}>
        Escucha cada pista en bucle. Se detiene al pulsar Detener o al escuchar otra pista.
      </Text>

      {Object.values(trackAssignments).includes('split') && <View style={styles.trackCard}>
        <Text style={styles.trackName}>División por registro: {Note.fromMidi(splitPoint)}</Text>
        <Text style={styles.subtitle}>Izquierda: notas inferiores. Derecha: desde esta nota. Es una aproximación; ajusta el límite si las manos se cruzan.</Text>
        <View style={styles.handButtons}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Bajar límite un semitono"
            style={styles.handBtn} onPress={() => setSplitPoint(splitPoint - 1)}><Text style={styles.playPreviewText}>− Semitono</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Subir límite un semitono"
            style={styles.handBtn} onPress={() => setSplitPoint(splitPoint + 1)}><Text style={styles.playPreviewText}>+ Semitono</Text></TouchableOpacity>
        </View>
      </View>}

      <ScrollView showsVerticalScrollIndicator={false}>
        {tracks.map((track) => {
          const assignment = trackAssignments[track.index] ?? 'none';
          const isPlaying = playingTrackIndex === track.index;

          return (
            <View key={track.index} style={styles.trackCard}>
              <View style={styles.trackHeader}>
                {/* Track info & preview button */}
                <View style={styles.trackInfo}>
                  <Text style={styles.trackName} numberOfLines={1}>
                    {track.name || `Pista ${track.index + 1}`}
                  </Text>
                  <Text style={styles.trackMeta}>
                    {track.notes.length} notas
                  </Text>
                </View>

                {/* Preview Play/Stop Button */}
                <TouchableOpacity
                  style={[styles.playPreviewBtn, isPlaying && styles.playPreviewBtnActive]}
                  onPress={() => handlePreviewTrack(track)}
                >
                  <Text style={styles.playPreviewText}>
                    {isPlaying ? '⏹ Detener' : '▶ Escuchar'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Hand selector buttons */}
              <View style={styles.handButtons}>
                {HAND_OPTIONS.map((opt) => {
                  const isActive = assignment === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.handBtn,
                        isActive && {
                          backgroundColor: HAND_COLORS[opt.value],
                          borderColor: HAND_COLORS[opt.value],
                        },
                      ]}
                      onPress={() => setTrackAssignment(track.index, opt.value)}
                    >
                      <Text style={styles.handBtnEmoji}>{opt.emoji}</Text>
                      <Text
                        style={[
                          styles.handBtnLabel,
                          isActive && styles.handBtnLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Active indicator bar */}
              {assignment !== 'none' && (
                <View
                  style={[
                    styles.activeIndicator,
                    { backgroundColor: HAND_COLORS[assignment] },
                  ]}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#BB86FC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 14,
  },
  trackCard: {
    backgroundColor: '#252535',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  trackInfo: {
    flex: 1,
    marginRight: 8,
  },
  trackName: {
    color: '#E0E0E0',
    fontWeight: '700',
    fontSize: 14,
  },
  trackMeta: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  playPreviewBtn: {
    backgroundColor: '#1A1330',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BB86FC',
  },
  playPreviewBtnActive: {
    backgroundColor: '#CF6679',
    borderColor: '#CF6679',
  },
  playPreviewText: {
    color: '#E0E0E0',
    fontSize: 12,
    fontWeight: '700',
  },
  handButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  handBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
  },
  handBtnEmoji: {
    fontSize: 13,
  },
  handBtnLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
    fontWeight: '600',
  },
  handBtnLabelActive: {
    color: '#0D0D14',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
});
