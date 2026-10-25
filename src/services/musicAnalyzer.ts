import { Chord, Scale, Interval } from '@tonaljs/tonal';
import { MidiNote, ParsedMidi } from '../store/practiceStore';
import { estimateKey } from './songAnalysis';

export interface AnalysisResult {
  chordOrArpeggio: string;
  chordNotes: string[];
  songKeyScale: string;
  suggestedScale: string;
  intervals: string[];
  patternType: PatternType;
  patternDescription: string;
  rootNote: string;
  pitchClasses: string[];
}

export type PatternType =
  | 'chord'
  | 'arpeggio'
  | 'scale_asc'
  | 'scale_desc'
  | 'chromatic'
  | 'melodic';

// ─── Spanish translations ──────────────────────────────────────────────────

const INTERVAL_NAMES: Record<string, string> = {
  '1P': 'Unísono',
  '2m': '2da menor (1 semitono)',
  '2M': '2da Mayor (1 tono)',
  '2A': '2da aumentada',
  '3m': '3ra menor (1½ tonos)',
  '3M': '3ra Mayor (2 tonos)',
  '4P': '4ta Justa (2½ tonos)',
  '4A': '4ta aumentada (Tritono)',
  '5d': '5ta disminuida (Tritono)',
  '5P': '5ta Justa (3½ tonos)',
  '5A': '5ta aumentada',
  '6m': '6ta menor (4 tonos)',
  '6M': '6ta Mayor (4½ tonos)',
  '7m': '7ma menor (5 tonos)',
  '7M': '7ma Mayor (5½ tonos)',
  '8P': 'Octava justa',
  '-2m': '2da menor descendente',
  '-2M': '2da Mayor descendente',
  '-3m': '3ra menor descendente',
  '-3M': '3ra Mayor descendente',
  '-4P': '4ta Justa descendente',
  '-5P': '5ta Justa descendente',
  '-8P': 'Octava descendente',
};

function translateInterval(raw: string): string {
  return INTERVAL_NAMES[raw] ?? raw;
}

function cleanPitchName(noteName: string): string {
  return noteName.replace(/\d+$/, '');
}

export function detectSongKey(midiData: ParsedMidi | null): string {
  return midiData ? estimateKey(midiData).name : 'Tonalidad libre';
}

// ─── Pattern Classifier ────────────────────────────────────────────────────

export function classifyPattern(notes: MidiNote[]): {
  type: PatternType;
  description: string;
} {
  if (notes.length === 0) return { type: 'melodic', description: 'Sin notas' };
  if (notes.length === 1) return { type: 'melodic', description: 'Nota individual' };

  const times = notes.map((n) => n.time);
  const timeSpread = Math.max(...times) - Math.min(...times);
  const pitchClasses = [...new Set(notes.map((n) => cleanPitchName(n.name)))];
  const detectedChords = Chord.detect(pitchClasses);

  // Check simultaneous notes (chord)
  if (timeSpread < 0.08 && notes.length >= 2) {
    const chordName = detectedChords[0] ? ` (${detectedChords[0]})` : '';
    return {
      type: 'chord',
      description: `Acorde armónico simultáneo${chordName}`,
    };
  }

  const midiNums = notes.map((n) => n.midi);
  const isAscending = midiNums.every((v, i) => i === 0 || v > midiNums[i - 1]);
  const isDescending = midiNums.every((v, i) => i === 0 || v < midiNums[i - 1]);

  // Check chromatic run
  const semitoneSteps = midiNums.map((v, i) => (i === 0 ? 0 : Math.abs(v - midiNums[i - 1])));
  const isChromatic = notes.length >= 3 && semitoneSteps.slice(1).every((s) => s === 1);

  if (isChromatic) {
    return {
      type: 'chromatic',
      description: `Pasaje cromático ${isAscending ? 'ascendente' : isDescending ? 'descendente' : 'mixto'}`,
    };
  }

  // Check arpeggio (successive notes forming a chord)
  if (detectedChords.length > 0 && notes.length >= 3) {
    const direction = isAscending ? 'ascendente' : isDescending ? 'descendente' : 'desplegado';
    return {
      type: 'arpeggio',
      description: `Arpegio ${direction} de ${detectedChords[0]}`,
    };
  }

  // Check scale progression
  const detectedScales = Scale.detect(pitchClasses);
  if (detectedScales.length > 0 && (isAscending || isDescending)) {
    return {
      type: isAscending ? 'scale_asc' : 'scale_desc',
      description: `Fragmento de escala ${isAscending ? 'ascendente' : 'descendente'} (${detectedScales[0]})`,
    };
  }

  return { type: 'melodic', description: 'Frase melódica lírica / libre' };
}

// ─── Main Analyzer ─────────────────────────────────────────────────────────

export function analyzeNotes(
  notes: MidiNote[] | { name: string }[],
  fullMidi?: ParsedMidi | null,
): AnalysisResult {
  if (notes.length === 0) {
    return {
      chordOrArpeggio: 'Sin acorde',
      chordNotes: [],
      songKeyScale: detectSongKey(fullMidi ?? null),
      suggestedScale: '—',
      intervals: [],
      patternType: 'melodic',
      patternDescription: 'No hay notas en este fragmento',
      rootNote: '—',
      pitchClasses: [],
    };
  }

  const pitchClasses = notes.map((n) => cleanPitchName(n.name));
  const uniquePitches = Array.from(new Set(pitchClasses));

  // Detect chord formed by this measure/segment
  const detectedChords = Chord.detect(uniquePitches);

  // Intervals between consecutive notes
  const intervals: string[] = [];
  for (let i = 0; i < notes.length - 1; i++) {
    const raw = Interval.distance(notes[i].name, notes[i + 1].name);
    intervals.push(translateInterval(raw));
  }

  // Pattern classification
  const hasMidi = (notes as MidiNote[])[0]?.midi !== undefined;
  const pattern = hasMidi
    ? classifyPattern(notes as MidiNote[])
    : { type: 'melodic' as PatternType, description: 'Patrón melódico' };

  // Global song key
  const songKey = detectSongKey(fullMidi ?? null);

  // Local scale detection
  const detectedScales = Scale.detect(uniquePitches);
  let suggested = 'Escala modal / Pentatónica';
  if (detectedScales.length > 0) {
    const commonScale = detectedScales.find((s) => s.includes('minor') || s.includes('major') || s.includes('pentatonic'));
    suggested = commonScale ?? detectedScales[0];
  } else {
    suggested = `Compatible con ${songKey}`;
  }

  return {
    chordOrArpeggio:
      detectedChords.length > 0
        ? detectedChords[0]
        : uniquePitches.length >= 2
        ? `${uniquePitches.join(' - ')} (Intervalo armónico)`
        : `${uniquePitches[0]} (Nota raíz)`,
    chordNotes: uniquePitches,
    songKeyScale: songKey,
    suggestedScale: suggested,
    intervals,
    patternType: pattern.type,
    patternDescription: pattern.description,
    rootNote: uniquePitches[0] || 'C',
    pitchClasses: uniquePitches,
  };
}
