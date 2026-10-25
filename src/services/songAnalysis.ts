import { Chord, Note, Scale } from '@tonaljs/tonal';
import type { MidiMeasure, MidiNote, ParsedMidi } from '../store/practiceStore';
import { analyzeIntervals } from './theoryIntervals';
import type { AnalyzedInterval } from './theoryIntervals';
import { chordFromSymbol } from './theoryExplainer';

const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface SongKey {
  name: string;
  notes: string[];
  coverage: number;
  alternative: string;
  declared: string[];
}
export interface Harmony {
  symbol: string;
  notes: string[];
  kind: 'Acorde' | 'Posible arpegio';
  beat: number;
}
export interface MeasureAnalysis {
  measure: MidiMeasure;
  pitches: string[];
  harmonies: Harmony[];
  intervals: AnalyzedInterval[];
}
export interface SongAnalysis {
  key: SongKey;
  measures: MeasureAnalysis[];
  chords: string[];
  arpeggios: string[];
}

function correlation(a: number[], b: number[]): number {
  const meanA = a.reduce((x, y) => x + y, 0) / 12;
  const meanB = b.reduce((x, y) => x + y, 0) / 12;
  let numerator = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) {
    const x = a[i] - meanA, y = b[i] - meanB;
    numerator += x * y; da += x * x; db += y * y;
  }
  return numerator / (Math.sqrt(da * db) || 1);
}

export function estimateKey(midi: ParsedMidi): SongKey {
  const weights = Array<number>(12).fill(0);
  for (const track of midi.tracks.filter((t) => !t.isPercussion)) {
    for (const note of track.notes) weights[note.midi % 12] += Math.max(0, note.duration);
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const declared = (midi.keySignatures ?? []).map((k) => `${k.key} ${k.scale === 'minor' ? 'menor' : 'mayor'} (${k.time.toFixed(1)} s)`);
  if (!total) return { name: 'Sin evidencia tonal', notes: [], coverage: 0, alternative: '—', declared };
  const candidates = TONICS.flatMap((tonic, root) => [
    { tonic, type: 'major', label: 'mayor', profile: MAJOR },
    { tonic, type: 'minor', label: 'menor natural', profile: MINOR },
  ].map((c) => ({ ...c, score: correlation(weights, weights.map((_, i) => c.profile[(i - root + 12) % 12])) })))
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  // A raised sixth/seventh is evidence for a minor variant, not a new tonic.
  const variants = best.type === 'minor'
    ? [{ type: 'minor', label: 'menor natural' }, { type: 'harmonic minor', label: 'menor armónica' }, { type: 'melodic minor', label: 'menor melódica' }]
    : [{ type: 'major', label: 'mayor' }];
  const scales = variants.map((v) => {
    const notes = Scale.get(`${best.tonic} ${v.type}`).notes;
    const included = new Set(notes.map((n) => Note.chroma(n)));
    const coverage = weights.reduce((sum, w, i) => sum + (included.has(i) ? w : 0), 0) / total;
    return { ...v, notes, coverage };
  }).sort((a, b) => b.coverage - a.coverage);
  return { name: `${best.tonic} ${scales[0].label}`, notes: scales[0].notes,
    coverage: scales[0].coverage, alternative: `${candidates[1].tonic} ${candidates[1].label}`, declared };
}

function pitches(notes: MidiNote[]): string[] {
  return [...new Set([...notes].sort((a, b) => a.midi - b.midi).map((n) => TONICS[n.midi % 12]))];
}

function fallbackMeasures(midi: ParsedMidi): MidiMeasure[] {
  const [n, d] = midi.timeSignature;
  const beat = 60 / midi.tempo * 4 / d;
  return Array.from({ length: Math.ceil(midi.durationSeconds / (beat * n)) }, (_, i) => ({
    number: i + 1, startTime: i * beat * n, endTime: Math.min((i + 1) * beat * n, midi.durationSeconds),
    beatTimes: Array.from({ length: n }, (_, j) => (i * n + j) * beat), timeSignature: midi.timeSignature,
  }));
}

export function analyzeSong(midi: ParsedMidi): SongAnalysis {
  const tracks = midi.tracks.filter((t) => !t.isPercussion);
  const grid = midi.measures ?? fallbackMeasures(midi);
  const measures: MeasureAnalysis[] = grid.map((measure) => ({ measure, pitches: [], harmonies: [], intervals: [] }));
  // Bucket notes once, including sustained notes crossing measure boundaries.
  const buckets = grid.map(() => new Map<number, MidiNote[]>());
  for (const track of tracks) {
    let cursor = 0;
    for (const note of [...track.notes].sort((a, b) => a.time - b.time)) {
      while (cursor < grid.length && grid[cursor].endTime <= note.time + 1e-7) cursor++;
      for (let i = cursor; i < grid.length && grid[i].startTime < note.time + note.duration; i++) {
        const notes = buckets[i].get(track.index) ?? [];
        notes.push(note); buckets[i].set(track.index, notes);
      }
    }
  }
  measures.forEach((result, i) => {
    const { measure } = result;
    const notes = [...buckets[i].values()].flat().sort((a, b) => a.time - b.time || a.midi - b.midi);
    result.pitches = pitches(notes);
    result.intervals = analyzeIntervals(tracks, measure);
    const add = (group: MidiNote[], kind: Harmony['kind'], time: number) => {
      const pcs = pitches(group);
      if (pcs.length < 3) return;
      const symbol = Chord.detect(pcs)[0];
      if (!symbol) return;
      const beat = Math.max(1, measure.beatTimes.filter((t) => t <= time + 1e-7).length);
      if (!result.harmonies.some((h) => h.symbol === symbol && h.kind === kind && h.beat === beat)) {
        result.harmonies.push({ symbol, notes: chordFromSymbol(symbol).notes, kind, beat });
      }
    };
    // Sample actual onsets and beat boundaries, preserving sustained harmony.
    const times = [...new Set([...measure.beatTimes, ...notes.map((n) => Math.max(n.time, measure.startTime))])];
    let lastSymbol = '';
    for (const time of times.sort((a, b) => a - b)) {
      const active = notes.filter((n) => n.time <= time + 1e-7 && n.time + n.duration > time + 1e-7);
      const symbol = pitches(active).length >= 3 ? Chord.detect(pitches(active))[0] : '';
      if (symbol && symbol !== lastSymbol) add(active, 'Acorde', time);
      lastSymbol = symbol ?? '';
    }
    // Search each voice and each beat so melody notes do not mask accompaniment.
    const voices = [...buckets[i].values()];
    if (voices.length > 1) voices.push(notes);
    for (const voice of voices) {
      const groups = [voice, ...measure.beatTimes.map((start, b) => voice.filter((n) =>
        n.time >= start && n.time < (measure.beatTimes[b + 1] ?? measure.endTime)))];
      for (const group of groups) {
        const attacks = group.filter((n) => n.time >= measure.startTime);
        const onsets = [...new Set(attacks.map((n) => n.time))].sort((a, b) => a - b);
        if (onsets.length < 3 || onsets.some((t, j) => j > 0 && t - onsets[j - 1] < 0.04)) continue;
        // Broken chords may alternate a bass note with a dyad (as in Old Doll).
        // Repeated complete block chords are not evidence of an arpeggio.
        if (onsets.some((t) => pitches(attacks.filter((n) => n.time === t)).length >= 3)) continue;
        add(attacks, 'Posible arpegio', onsets[0]);
      }
    }
    result.harmonies.sort((a, b) => a.beat - b.beat);
  });
  return { key: estimateKey(midi), measures,
    chords: [...new Set(measures.flatMap((m) => m.harmonies.filter((h) => h.kind === 'Acorde').map((h) => h.symbol)))],
    arpeggios: [...new Set(measures.flatMap((m) => m.harmonies.filter((h) => h.kind === 'Posible arpegio').map((h) => h.symbol)))],
  };
}
