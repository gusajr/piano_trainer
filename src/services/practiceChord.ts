import type { MidiNote } from '../store/practiceStore';

export function practiceChord(notes: MidiNote[], index: number): MidiNote[] {
  const first = notes[index];
  if (!first) return [];
  const chord: MidiNote[] = [];
  for (let i = index; i < notes.length && notes[i].time - first.time < 0.05; i++) chord.push(notes[i]);
  return chord;
}

/** Accept all required pitches together or accumulated across separate taps. */
export function evaluateChordProgress(
  target: MidiNote[],
  held: ReadonlySet<number>,
  played: ReadonlySet<number> = held,
): 'waiting' | 'correct' | 'wrong' {
  const required = new Set(target.map((n) => n.midi));
  if (!required.size) return 'waiting';
  if ([...held].some((pitch) => !required.has(pitch))) return 'wrong';
  return [...required].every((pitch) => played.has(pitch)) ? 'correct' : 'waiting';
}
