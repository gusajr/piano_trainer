import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Button, Alert } from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Midi } from '@tonejs/midi';
import { analyzeNotes } from './src/services/musicAnalyzer';
import { PIANO_SAMPLES } from './src/services/pianoSamples';

const PANO_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export default function App() {
  const [durationSeconds, setDurationSeconds] = useState<number>(2);
  const [midiNotes, setMidiNotes] = useState<any[]>([
    { name: 'C4' },
    { name: 'E4' },
    { name: 'G4' }
  ]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [fileName, setFileName] = useState<string>('Ningún archivo MIDI cargado');

  // Configuración de audio en segundo plano / silencio para iOS
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    });
  }, []);

  // Reproductores de audio independientes por cada nota con expo-audio
  const playerC = useAudioPlayer(PIANO_SAMPLES[60]);
  const playerD = useAudioPlayer(PIANO_SAMPLES[62]);
  const playerE = useAudioPlayer(PIANO_SAMPLES[64]);
  const playerF = useAudioPlayer(PIANO_SAMPLES[65]);
  const playerG = useAudioPlayer(PIANO_SAMPLES[67]);
  const playerA = useAudioPlayer(PIANO_SAMPLES[69]);
  const playerB = useAudioPlayer(PIANO_SAMPLES[71]);

  const playersMap: { [key: string]: any } = {
    'C': playerC,
    'D': playerD,
    'E': playerE,
    'F': playerF,
    'G': playerG,
    'A': playerA,
    'B': playerB,
  };

  const playNoteSound = async (note: string) => {
    try {
      const activePlayer = playersMap[note];
      if (activePlayer) {
        activePlayer.seekTo(0);
        activePlayer.play();
      }
    } catch (error) {
      console.log("Error al reproducir audio:", error);
    }
  };

  // Selector y procesador de archivos MIDI locales (.mid)
  const pickAndParseMidiFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/midi', 'audio/mid', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setFileName(asset.name);

        // Obtenemos los bytes del archivo MIDI mediante fetch a su URI local de caché
        const response = await fetch(asset.uri);
        const arrayBuffer = await response.arrayBuffer();

        // Parseamos el binario con @tonejs/midi
        const midi = new Midi(arrayBuffer);
        
        let extractedNotes: any[] = [];
        midi.tracks.forEach((track) => {
          track.notes.forEach((note) => {
            // Filtramos y cortamos las notas que caen dentro del micro-loop (0 a durationSeconds)
            if (note.time <= durationSeconds) {
              extractedNotes.push({
                name: note.name,
                time: note.time,
                duration: note.duration,
              });
            }
          });
        });

        if (extractedNotes.length > 0) {
          setMidiNotes(extractedNotes);
          setFeedback(`¡MIDI recortado con éxito! Se encontraron ${extractedNotes.length} notas en los primeros ${durationSeconds} segundos.`);
        } else {
          setFeedback(`No se encontraron notas en los primeros ${durationSeconds} segundos. Prueba aumentando la duración.`);
        }
      }
    } catch (error) {
      console.log("Error al cargar el MIDI:", error);
      Alert.alert("Error", "No se pudo procesar el archivo MIDI seleccionado.");
    }
  };

  // Análisis teórico dinámico basado en las notas extraídas del MIDI
  const analysis = analyzeNotes(midiNotes);

  const handleNotePress = async (note: string) => {
    setSelectedNote(note);
    await playNoteSound(note);

    const targetNote = midiNotes[0]?.name ? midiNotes[0].name.slice(0, -1) : 'C';
    
    if (note === targetNote) {
      setFeedback('¡Correcto! Has memorizado la nota del fragmento.');
    } else {
      setFeedback(`Incorrecto. La nota clave era ${targetNote}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <Text style={styles.headerTitle}>Entrenador de Piano MIDI</Text>

        {/* Sección 1: Selección de Duración y Carga de Archivo MIDI */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Micro-Loop y Carga MIDI</Text>
          <Text style={styles.subText}>Fragmento a repetir: {durationSeconds} segundos</Text>
          
          <View style={styles.buttonRow}>
            {[1, 2, 3].map((sec) => (
              <TouchableOpacity
                key={sec}
                style={[styles.chipButton, durationSeconds === sec && styles.chipActive]}
                onPress={() => setDurationSeconds(sec)}
              >
                <Text style={[styles.chipText, durationSeconds === sec && styles.chipTextActive]}>
                  {sec} seg
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.uploadContainer}>
            <Button title="Cargar Archivo MIDI (.mid)" onPress={pickAndParseMidiFile} color="#BB86FC" />
            <Text style={styles.fileText} numberOfLines={1}>Archivo: {fileName}</Text>
          </View>
        </View>

        {/* Sección 2: Análisis Teórico Automático del Fragmento */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Análisis del Fragmento Recortado</Text>
          <Text style={styles.infoText}>🎹 Arpegio/Acorde: <Text style={styles.bold}>{analysis.chordOrArpeggio}</Text></Text>
          <Text style={styles.infoText}>🎶 Escala sugerida: <Text style={styles.bold}>{analysis.suggestedScale}</Text></Text>
          <Text style={styles.infoText}>📏 Intervalos: <Text style={styles.bold}>{analysis.intervals.join(', ') || 'N/A'}</Text></Text>
        </View>

        {/* Sección 3: Teclado de Práctica CDEFGAB */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Acierta la Nota</Text>
          <Text style={styles.instruction}>Toca la tecla para escuchar el piano y validar tu respuesta:</Text>
          
          <View style={styles.pianoContainer}>
            {PANO_NOTES.map((note) => (
              <TouchableOpacity
                key={note}
                style={[
                  styles.pianoKey,
                  selectedNote === note && styles.selectedKey
                ]}
                onPress={() => handleNotePress(note)}
              >
                <Text style={styles.keyText}>{note}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  scrollContainer: { padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#BB86FC', marginBottom: 8 },
  subText: { color: '#B0BEC5', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  chipButton: { flex: 1, paddingVertical: 10, marginHorizontal: 4, backgroundColor: '#2C2C2C', borderRadius: 8, alignItems: 'center' },
  chipActive: { backgroundColor: '#BB86FC' },
  chipText: { color: '#fff', fontWeight: '500' },
  chipTextActive: { color: '#121212', fontWeight: 'bold' },
  uploadContainer: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#2C2C2C', paddingTop: 12 },
  fileText: { color: '#B0BEC5', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  infoText: { color: '#E0E0E0', fontSize: 14, marginBottom: 6 },
  bold: { fontWeight: 'bold', color: '#03DAC6' },
  instruction: { color: '#B0BEC5', fontSize: 13, marginBottom: 12 },
  pianoContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  pianoKey: { flex: 1, height: 75, backgroundColor: '#FFFFFF', marginHorizontal: 2, borderRadius: 6, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8 },
  selectedKey: { backgroundColor: '#BB86FC' },
  keyText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  feedbackText: { marginTop: 14, textAlign: 'center', fontSize: 15, fontWeight: 'bold', color: '#03DAC6' },
});