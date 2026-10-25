import { Interval } from '@tonaljs/tonal';
import type { MidiMeasure, MidiNote, ParsedTrack } from '../store/practiceStore';
import { intervalName } from './theoryExplainer';

export interface AnalyzedInterval {
  from: string; to: string; semitones: number; code: string; label: string;
  kind: 'Melódico' | 'Armónico'; beat: number;
}

/** Preserve voices: never call a jump between simultaneous notes a melody. */
export function analyzeIntervals(tracks: ParsedTrack[], measure: MidiMeasure): AnalyzedInterval[] {
  const result: AnalyzedInterval[] = [];
  const add = (a: MidiNote, b: MidiNote, kind: AnalyzedInterval['kind'], time: number) => {
    const semitones = b.midi - a.midi;
    const code = Interval.fromSemitones(semitones);
    const beat = Math.max(1, measure.beatTimes.filter((t) => t <= time + 1e-7).length);
    if (!result.some((i) => i.from === a.name && i.to === b.name && i.kind === kind && i.beat === beat)) {
      result.push({ from: a.name, to: b.name, semitones, code,
        label: kind === 'Armónico' ? intervalName(Math.abs(semitones)).replace(' ascendente', '') : intervalName(semitones), kind, beat });
    }
  };
  const allNotes: MidiNote[] = [];
  for (const track of tracks) {
    const notes = track.notes.filter((n) => n.time < measure.endTime && n.time + n.duration > measure.startTime)
      .sort((a, b) => a.time - b.time || a.midi - b.midi);
    allNotes.push(...notes);
    // Include the preceding attack when a melodic step crosses a bar line.
    const previousTime = track.notes.reduce((latest, n) => n.time < measure.startTime ? Math.max(latest, n.time) : latest, -Infinity);
    const previous = track.notes.filter((n) => n.time === previousTime && !notes.includes(n));
    notes.unshift(...previous);
    notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
    const onsets: MidiNote[][] = [];
    for (const note of notes) {
      const last = onsets[onsets.length - 1];
      if (last && Math.abs(last[0].time - note.time) < 0.03) last.push(note);
      else onsets.push([note]);
    }
    for (let i = 1; i < onsets.length; i++) {
      // Polyphonic onsets are reported as harmonic intervals below.
      if (onsets[i - 1].length === 1 && onsets[i].length === 1 && onsets[i][0].time >= measure.startTime) {
        add(onsets[i - 1][0], onsets[i][0], 'Melódico', onsets[i][0].time);
      }
    }
  }
  for (const time of [...new Set([measure.startTime, ...allNotes.filter((n) => n.time >= measure.startTime).map((n) => n.time)])]) {
    const active = allNotes.filter((n) => n.time <= time + 1e-7 && n.time + n.duration > time + 1e-7).sort((a, b) => a.midi - b.midi);
    for (let a = 0; a < active.length; a++) {
      for (let b = a + 1; b < active.length; b++) add(active[a], active[b], 'Armónico', time);
    }
  }
  return result.sort((a, b) => a.beat - b.beat);
}
