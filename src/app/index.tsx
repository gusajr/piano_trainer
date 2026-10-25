import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { usePracticeStore } from '../store/practiceStore';
import { parseMidi } from '../services/midiParser';
import HandPicker from '../components/HandPicker';
import SegmentPicker from '../components/SegmentPicker';

export default function HomeScreen() {
  const { midiData, fileName, segmentNotes, loadMidi, activeHand, setActiveHand } =
    usePracticeStore();
  const [loading, setLoading] = useState(false);

  // ── MIDI loading ────────────────────────────────────────────────────────
  const pickMidi = async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/midi', 'audio/mid', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const response = await fetch(asset.uri);
        const buffer = await response.arrayBuffer();
        const parsed = parseMidi(buffer);

        if (parsed.tracks.length === 0) {
          Alert.alert('MIDI vacío', 'El archivo no contiene notas.');
          return;
        }

        loadMidi(parsed, asset.name);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo procesar el MIDI.');
    } finally {
      setLoading(false);
    }
  };

  // ── Hand selector ────────────────────────────────────────────────────────
  const HAND_OPTS: { label: string; value: typeof activeHand; emoji: string }[] = [
    { label: 'Derecha', value: 'right', emoji: '🤚' },
    { label: 'Izquierda', value: 'left', emoji: '🫱' },
    { label: 'Ambas', value: 'both', emoji: '🙌' },
  ];

  const canPractice = midiData !== null && segmentNotes.length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ── */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>🎹</Text>
        <Text style={styles.heroTitle}>Piano Trainer</Text>
        <Text style={styles.heroSubtitle}>
          Carga tu MIDI, elige un fragmento y{'\n'}aprende nota por nota
        </Text>
      </View>

      {/* ── Step 1: Load MIDI ── */}
      <View style={styles.section}>
        <Text style={styles.stepLabel}>PASO 1</Text>
        <Text style={styles.sectionTitle}>Cargar archivo MIDI</Text>

        <TouchableOpacity
          style={[styles.uploadBtn, loading && styles.uploadBtnLoading]}
          onPress={pickMidi}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#BB86FC" />
          ) : (
            <Text style={styles.uploadBtnText}>
              {midiData ? '📂 Cambiar MIDI' : '📂 Seleccionar MIDI (.mid)'}
            </Text>
          )}
        </TouchableOpacity>

        {fileName ? (
          <View style={styles.fileChip}>
            <Text style={styles.fileChipText}>🎵 {fileName}</Text>
            {midiData && (
              <Text style={styles.fileChipMeta}>
                {midiData.tracks.length} tracks · {Math.round(midiData.tempo)} BPM ·{' '}
                {midiData.timeSignature[0]}/{midiData.timeSignature[1]}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {/* ── Step 2: Assign tracks to hands ── */}
      {midiData && midiData.tracks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>PASO 2</Text>
          <Text style={styles.sectionTitle}>Asignar tracks a manos</Text>
          <HandPicker tracks={midiData.tracks} />
        </View>
      )}

      {/* ── Step 3: Active hand to practice ── */}
      {midiData && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>PASO 3</Text>
          <Text style={styles.sectionTitle}>¿Qué mano practicar?</Text>
          <View style={styles.handRow}>
            {HAND_OPTS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.handChip,
                  activeHand === opt.value && styles.handChipActive,
                ]}
                onPress={() => setActiveHand(opt.value)}
              >
                <Text style={styles.handChipEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.handChipLabel,
                    activeHand === opt.value && styles.handChipLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Step 4: Choose segment ── */}
      {midiData && (
        <View style={styles.section}>
          <Text style={styles.stepLabel}>PASO 4</Text>
          <Text style={styles.sectionTitle}>Elegir fragmento</Text>
          <SegmentPicker />
        </View>
      )}

      {/* ── CTA: Go to practice ── */}
      <TouchableOpacity
        style={[styles.practiceBtn, !canPractice && styles.practiceBtnDisabled]}
        onPress={() => router.push('/practice')}
        disabled={!canPractice}
      >
        <Text style={styles.practiceBtnText}>
          {canPractice
            ? `▶  Practicar ${segmentNotes.length} notas`
            : midiData
            ? 'No hay notas en este segmento'
            : 'Carga un MIDI para comenzar'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0D0D14' },
  content: { padding: 16 },

  heroCard: {
    backgroundColor: '#1A1330',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BB86FC33',
  },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#E0E0E0',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  section: { marginBottom: 4 },
  stepLabel: {
    fontSize: 10,
    color: '#BB86FC',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
    marginLeft: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E0E0E0',
    marginBottom: 10,
  },

  uploadBtn: {
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BB86FC',
    borderStyle: 'dashed',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadBtnLoading: { opacity: 0.6 },
  uploadBtnText: { color: '#BB86FC', fontWeight: '700', fontSize: 15 },

  fileChip: {
    backgroundColor: '#1E1E2E',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  fileChipText: { color: '#E0E0E0', fontWeight: '600', fontSize: 13 },
  fileChipMeta: { color: '#666', fontSize: 11, marginTop: 3 },

  handRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  handChip: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  handChipActive: {
    backgroundColor: '#BB86FC22',
    borderColor: '#BB86FC',
  },
  handChipEmoji: { fontSize: 20, marginBottom: 4 },
  handChipLabel: { color: '#888', fontSize: 12, fontWeight: '600' },
  handChipLabelActive: { color: '#BB86FC' },

  practiceBtn: {
    backgroundColor: '#BB86FC',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#BB86FC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  practiceBtnDisabled: {
    backgroundColor: '#2C2C3E',
    shadowOpacity: 0,
    elevation: 0,
  },
  practiceBtnText: {
    color: '#0D0D14',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
