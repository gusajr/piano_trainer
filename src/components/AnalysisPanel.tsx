import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnalysisResult, PatternType } from '../services/musicAnalyzer';

interface AnalysisPanelProps {
  analysis: AnalysisResult;
}

const PATTERN_META: Record<PatternType, { emoji: string; color: string; title: string }> = {
  chord:      { emoji: '🎹', color: '#FF8A65', title: 'Acorde' },
  arpeggio:   { emoji: '🎶', color: '#64B5F6', title: 'Arpegio' },
  scale_asc:  { emoji: '📈', color: '#81C784', title: 'Escala Ascendente' },
  scale_desc: { emoji: '📉', color: '#4DB6AC', title: 'Escala Descendente' },
  chromatic:  { emoji: '🌈', color: '#CE93D8', title: 'Cromatismo' },
  melodic:    { emoji: '🎼', color: '#FFD54F', title: 'Frase Melódica' },
};

export default function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const meta = PATTERN_META[analysis.patternType];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎼 Análisis Armónico y Teórico</Text>

      {/* 1. Tonalidad General de la Canción */}
      <View style={[styles.card, { borderLeftColor: '#BB86FC' }]}>
        <Text style={styles.cardLabel}>Tonalidad / Escala estimada de la Canción</Text>
        <Text style={[styles.cardValue, { color: '#BB86FC' }]}>
          🎵  {analysis.songKeyScale}
        </Text>
        <Text style={styles.cardSub}>
          Calculada con el conjunto total de pistas y notas de la obra
        </Text>
      </View>

      {/* 2. Tipo de Patrón del Fragmento */}
      <View style={[styles.card, { borderLeftColor: meta.color }]}>
        <Text style={styles.cardLabel}>Estructura del Fragmento</Text>
        <Text style={[styles.cardValue, { color: meta.color }]}>
          {meta.emoji}  {analysis.patternDescription}
        </Text>
      </View>

      {/* 3. Acorde o Arpegio */}
      <View style={[styles.card, { borderLeftColor: '#64B5F6' }]}>
        <Text style={styles.cardLabel}>Conjunto de notas del fragmento practicado</Text>
        <Text style={[styles.cardValue, { color: '#64B5F6' }]}>
          🎹  {analysis.chordOrArpeggio}
        </Text>
        {analysis.pitchClasses.length > 0 && (
          <Text style={styles.cardSub}>
            Notas que lo forman: {analysis.pitchClasses.join(' · ')}
          </Text>
        )}
      </View>

      {/* 4. Escala sugerida para este pasaje */}
      <View style={[styles.card, { borderLeftColor: '#81C784' }]}>
        <Text style={styles.cardLabel}>Modo o Escala Local</Text>
        <Text style={[styles.cardValue, { color: '#81C784' }]}>
          🎼  {analysis.suggestedScale}
        </Text>
      </View>

      {/* 5. Intervalos melódicos paso a paso */}
      {analysis.intervals.length > 0 && (
        <View style={[styles.card, { borderLeftColor: '#FFD54F' }]}>
          <Text style={styles.cardLabel}>
            Intervalos entre notas consecutivas ({analysis.intervals.length})
          </Text>
          <View style={styles.intervalList}>
            {analysis.intervals.map((interval, i) => (
              <View key={i} style={styles.intervalRow}>
                <Text style={styles.intervalIndex}>Paso {i + 1}:</Text>
                <Text style={styles.intervalName}>{interval}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2F2F44',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#BB86FC',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#252538',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  cardLabel: {
    fontSize: 11,
    color: '#AAA',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardSub: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  intervalList: {
    marginTop: 6,
    gap: 4,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  intervalIndex: {
    color: '#888',
    fontSize: 11,
    width: 60,
    fontWeight: '600',
  },
  intervalName: {
    color: '#FFD54F',
    fontSize: 12,
    fontWeight: '700',
  },
});
