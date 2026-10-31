import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList } from 'react-native';
import { usePracticeStore } from '../store/practiceStore';

export default function SegmentPicker() {
  const {
    midiData,
    startMeasure,
    measureCount,
    totalMeasures,
    segmentNotes,
    setStartMeasure,
    setMeasureCount,
  } = usePracticeStore();

  if (!midiData) return null;

  const endMeasure = Math.min(totalMeasures, startMeasure + measureCount - 1);
  const canGoPrev = startMeasure > 1;
  const canGoNext = endMeasure < totalMeasures;

  const handlePrev = () => {
    setStartMeasure(Math.max(1, startMeasure - measureCount));
  };

  const handleNext = () => {
    setStartMeasure(Math.min(totalMeasures, startMeasure + measureCount));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎼 Selección de Compases a Estudiar</Text>

      {/* Selector de cantidad de compases continuos */}
      <View style={styles.section}>
        <Text style={styles.label}>Compases continuos a memorizar:</Text>
        <FlatList
          horizontal
          data={Array.from({ length: totalMeasures - startMeasure + 1 }, (_, i) => i + 1)}
          keyExtractor={(count) => String(count)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.optionsScrollContent}
          renderItem={({ item: count }) => {
            const isSelected = measureCount === count;
            return (
              <TouchableOpacity
                key={count}
                activeOpacity={0.7}
                style={[styles.countBtn, isSelected && styles.countBtnActive]}
                onPress={() => setMeasureCount(count)}
              >
                <Text style={[styles.countBtnText, isSelected && styles.countBtnTextActive]}>
                  {count} {count === 1 ? 'compás' : 'compases'}{count === totalMeasures - startMeasure + 1 ? ' · hasta el final' : ''}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
        <TouchableOpacity style={styles.countBtn} onPress={() => setMeasureCount(totalMeasures - startMeasure + 1)}>
          <Text style={styles.countBtnText}>Seleccionar hasta el final ({totalMeasures - startMeasure + 1} compases)</Text>
        </TouchableOpacity>
      </View>

      {/* Navegador principal de compases - Más grande, cómodo y legible */}
      <View style={styles.navCard}>
        <View style={styles.measureDisplay}>
          <Text style={styles.measureRangeText}>
            {startMeasure === endMeasure
              ? `Compás ${startMeasure}`
              : `Compases ${startMeasure} a ${endMeasure}`}
          </Text>
          <Text style={styles.measureMetaText}>
            de {totalMeasures} compases · {segmentNotes.length} notas seleccionadas
          </Text>
        </View>

        <View style={styles.navActionsRow}>
          <TouchableOpacity
            style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
            onPress={handlePrev}
            disabled={!canGoPrev}
            activeOpacity={0.7}
          >
            <Text style={styles.navBtnText}>◀ Compás anterior</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
            onPress={handleNext}
            disabled={!canGoNext}
            activeOpacity={0.7}
          >
            <Text style={styles.navBtnText}>Siguiente compás ▶</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Selector rápido deslizable */}
      <View style={styles.quickSection}>
        <Text style={styles.quickLabel}>Ir directo al compás:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickScrollContent}
        >
          {Array.from({ length: totalMeasures }, (_, i) => i + 1).map((m) => {
            const inRange = m >= startMeasure && m <= endMeasure;
            return (
              <TouchableOpacity
                key={m}
                activeOpacity={0.7}
                style={[styles.quickMeasureBtn, inRange && styles.quickMeasureBtnActive]}
                onPress={() => setStartMeasure(m)}
              >
                <Text style={[styles.quickMeasureText, inRange && styles.quickMeasureTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#BB86FC',
    marginBottom: 12,
  },
  section: {
    marginBottom: 14,
  },
  label: {
    color: '#B0BEC5',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  optionsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  countBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#252538',
    borderWidth: 1,
    borderColor: '#3D3D54',
  },
  countBtnActive: {
    backgroundColor: '#BB86FC',
    borderColor: '#BB86FC',
  },
  countBtnText: {
    color: '#C5C5D8',
    fontSize: 13,
    fontWeight: '600',
  },
  countBtnTextActive: {
    color: '#0D0D14',
    fontWeight: '800',
  },
  navCard: {
    backgroundColor: '#252538',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#34344A',
  },
  measureDisplay: {
    alignItems: 'center',
    marginBottom: 12,
  },
  measureRangeText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  measureMetaText: {
    color: '#03DAC6',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },
  navActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: '#BB86FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.25,
    borderColor: '#444',
  },
  navBtnText: {
    color: '#BB86FC',
    fontSize: 13,
    fontWeight: '700',
  },
  quickSection: {
    marginTop: 2,
  },
  quickLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  quickScrollContent: {
    paddingVertical: 2,
    gap: 6,
  },
  quickMeasureBtn: {
    minWidth: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#252538',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3D3D54',
    paddingHorizontal: 8,
  },
  quickMeasureBtnActive: {
    backgroundColor: '#03DAC6',
    borderColor: '#03DAC6',
  },
  quickMeasureText: {
    color: '#A0A0B4',
    fontSize: 13,
    fontWeight: '700',
  },
  quickMeasureTextActive: {
    color: '#0D0D14',
    fontWeight: '900',
  },
});
