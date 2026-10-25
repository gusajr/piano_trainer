import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePracticeStore } from '../store/practiceStore';
import type { ParsedMidi } from '../store/practiceStore';
import { analyzeSong, estimateKey } from '../services/songAnalysis';
import type { MeasureAnalysis } from '../services/songAnalysis';
import { selectHandMidi } from '../services/handSelection';
import TheoryTerm from './TheoryTerm';

export default function SongTheoryPanel({ midi, startMeasure = 1, measureCount = 1, initialScope = 'selection' }: {
  midi: ParsedMidi; startMeasure?: number; measureCount?: number; initialScope?: 'song' | 'selection';
}) {
  const { activeHand, trackAssignments, splitPoint } = usePracticeStore();
  const selectedMidi = useMemo(() => selectHandMidi(midi, trackAssignments, activeHand, splitPoint), [midi, trackAssignments, activeHand, splitPoint]);
  const analysis = useMemo(() => analyzeSong(selectedMidi), [selectedMidi]);
  const [scope, setScope] = useState<'song' | 'selection'>(initialScope);
  const [page, setPage] = useState(0);
  const measures = useMemo(() => scope === 'song' ? analysis.measures : analysis.measures.slice(startMeasure - 1, startMeasure - 1 + measureCount), [scope, analysis, startMeasure, measureCount]);
  const key = useMemo(() => {
    if (scope === 'song') return analysis.key;
    const start = measures[0]?.measure.startTime ?? 0;
    const end = measures[measures.length - 1]?.measure.endTime ?? 0;
    return estimateKey({ ...selectedMidi, tracks: selectedMidi.tracks.map((t) => ({ ...t,
      notes: t.notes.filter((n) => n.time < end && n.time + n.duration > start).map((n) => ({ ...n,
        duration: Math.min(n.time + n.duration, end) - Math.max(n.time, start),
      })),
    })) });
  }, [scope, measures, analysis.key, selectedMidi]);
  const chords = [...new Set(measures.flatMap((m) => m.harmonies.filter((h) => h.kind === 'Acorde').map((h) => h.symbol)))];
  const arpeggios = [...new Set(measures.flatMap((m) => m.harmonies.filter((h) => h.kind === 'Posible arpegio').map((h) => h.symbol)))];
  const intervalSummary = [...new Map(measures.flatMap((m) => m.intervals).map((i) => [`${i.kind}:${i.code}`, i])).values()];
  const pages = Math.max(1, Math.ceil(measures.length / 8));
  const currentPage = Math.min(page, pages - 1);
  const visible = measures.slice(currentPage * 8, currentPage * 8 + 8);
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Teoría de lo aprendido</Text>
      <Text style={styles.measureTitle}>Mano: {activeHand === 'left' ? 'izquierda' : activeHand === 'right' ? 'derecha' : 'ambas'} · {scope === 'song' ? 'toda la canción' : `compases ${startMeasure}–${startMeasure + measures.length - 1}`}</Text>
      <Text style={styles.hint}>Toca los términos con ⓘ para ver qué significan y cómo se forman. El análisis usa las mismas notas y asignaciones de manos que la práctica.</Text>
      <View style={styles.row}>
        {(['song', 'selection'] as const).map((value) => <TouchableOpacity
          key={value} accessibilityRole="button" accessibilityState={{ selected: scope === value }}
          onPress={() => { setScope(value); setPage(0); }} style={[styles.button, scope === value && styles.active]}>
          <Text style={styles.text}>{value === 'song' ? 'Toda la canción' : 'Compases elegidos'}</Text>
        </TouchableOpacity>)}
      </View>
      <Text style={styles.label}>Tonalidad y escala estimadas {scope === 'selection' ? 'del fragmento' : 'de la canción'}</Text>
      <TheoryTerm topic={{ kind: 'scale', value: key.name }} />
      <View style={styles.row}>{key.notes.map((n) => <TheoryTerm key={n} topic={{ kind: 'note', value: n }} />)}</View>
      {key.notes.length > 0 && <>
        <Text style={styles.hint}>{Math.round(key.coverage * 100)}% de la duración de las notas pertenece a esta escala. Un fragmento breve puede ser tonalmente ambiguo.</Text>
        <Text style={styles.hint}>Otra tonalidad posible:</Text>
        <TheoryTerm topic={{ kind: 'scale', value: key.alternative }} />
      </>}
      <Text style={styles.label}>Acordes detectados en este alcance</Text>
      <View style={styles.row}>{chords.map((c) => <TheoryTerm key={c} topic={{ kind: 'chord', value: c }} />)}</View>
      {!chords.length && <Text style={styles.hint}>Sin acordes completos identificables en esta mano.</Text>}
      <Text style={styles.label}>Posibles arpegios</Text>
      <View style={styles.row}>{arpeggios.map((c) => <TheoryTerm key={c} topic={{ kind: 'arpeggio', value: c }} />)}</View>
      {!arpeggios.length && <Text style={styles.hint}>Sin arpegios completos identificables en esta mano.</Text>}
      <Text style={styles.label}>Intervalos encontrados</Text>
      <View style={styles.row}>{intervalSummary.map((i) => <TheoryTerm key={`${i.kind}:${i.code}`} topic={{ kind: 'interval', value: i.code, harmonic: i.kind === 'Armónico' }}>{i.kind}: {i.label}</TheoryTerm>)}</View>
      {!intervalSummary.length && <Text style={styles.hint}>No hay suficientes notas para determinar intervalos.</Text>}
      <Text style={styles.hint}>Estimación automática: las notas de paso e inversiones pueden dar otras interpretaciones. Los intervalos melódicos se calculan entre ataques de una sola nota en la misma pista; los armónicos, entre notas que suenan a la vez.</Text>
      {visible.map((result) => <MeasureTheory key={`${activeHand}:${result.measure.number}`} result={result} />)}
      {measures.length === 0 && <Text style={styles.hint}>No hay compases en esta selección.</Text>}
      {pages > 1 && <View style={styles.row}>
        <TouchableOpacity accessibilityRole="button" disabled={currentPage === 0}
          style={[styles.button, currentPage === 0 && styles.disabled]} onPress={() => setPage(currentPage - 1)}>
          <Text style={styles.text}>Anterior</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>{currentPage + 1} / {pages}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={currentPage === pages - 1}
          style={[styles.button, currentPage === pages - 1 && styles.disabled]} onPress={() => setPage(currentPage + 1)}>
          <Text style={styles.text}>Siguiente</Text>
        </TouchableOpacity>
      </View>}
    </View>
  );
}

function MeasureTheory({ result }: { result: MeasureAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const { measure, pitches, harmonies, intervals } = result;
  return <View style={styles.measure}>
    <Text style={styles.measureTitle}>Compás {measure.number} · {measure.timeSignature.join('/')}</Text>
    {harmonies.map((h, i) => <View key={i}>
      <Text style={styles.text}>Pulso {h.beat} · {h.kind}</Text>
      <TheoryTerm topic={{ kind: h.kind === 'Acorde' ? 'chord' : 'arpeggio', value: h.symbol }}>{h.symbol} ({h.notes.join(' · ')})</TheoryTerm>
    </View>)}
    {!harmonies.length && <Text style={styles.hint}>{pitches.length ? 'Pasaje sin acorde completo identificable' : 'Silencio en esta mano'}</Text>}
    <Text style={styles.label}>Notas presentes</Text>
    <View style={styles.row}>{pitches.map((n) => <TheoryTerm key={n} topic={{ kind: 'note', value: n }} />)}</View>
    <Text style={styles.label}>Intervalos ({intervals.length})</Text>
    {(expanded ? intervals : intervals.slice(0, 8)).map((interval, i) => <View key={i}>
      <Text style={styles.hint}>Pulso {interval.beat} · {interval.kind} · {interval.from} → {interval.to}</Text>
      <TheoryTerm topic={{ kind: 'interval', value: interval.code, harmonic: interval.kind === 'Armónico' }}>{interval.label} · {Math.abs(interval.semitones)} semitonos</TheoryTerm>
    </View>)}
    {intervals.length > 8 && <TouchableOpacity style={styles.button} accessibilityRole="button" onPress={() => setExpanded(!expanded)}>
      <Text style={styles.text}>{expanded ? 'Mostrar menos intervalos' : `Ver los ${intervals.length} intervalos`}</Text>
    </TouchableOpacity>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#1E1E2E', borderRadius: 16, padding: 16, marginVertical: 16, gap: 8 },
  title: { color: '#BB86FC', fontSize: 18, fontWeight: '800' },
  key: { color: '#BB86FC', fontSize: 22, fontWeight: '800' },
  label: { color: '#81C784', fontSize: 13, fontWeight: '700', marginTop: 8 },
  text: { color: '#E0E0E0', fontSize: 13, lineHeight: 20 },
  hint: { color: '#A6A6BA', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  button: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 10, backgroundColor: '#303047' },
  active: { backgroundColor: '#61428A' },
  disabled: { opacity: 0.35 },
  measure: { backgroundColor: '#252538', padding: 12, borderRadius: 10, gap: 4 },
  measureTitle: { color: '#64B5F6', fontSize: 14, fontWeight: '700' },
});
