import type { MidiNote } from '../store/practiceStore';
import { pitchClass } from './pitchDetection';

export function evaluateExternalNotes(target: MidiNote[], detected: number[], previous: ReadonlySet<number>) {
  const matched = new Set(previous);
  const classes = new Set(detected.map(pitchClass));
  const required = new Set(target.map((note) => pitchClass(note.midi)));
  for (const note of target) if (classes.has(pitchClass(note.midi))) matched.add(note.midi);
  const result = !target.length || !detected.length ? 'waiting'
    : [...classes].some((pitch) => !required.has(pitch)) ? 'wrong'
    : target.every((note) => matched.has(note.midi)) ? 'correct' : 'waiting';
  return { matched, result };
}
