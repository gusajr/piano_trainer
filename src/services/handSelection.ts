import type { ActiveHand, HandAssignment, ParsedMidi } from '../store/practiceStore';

/** The same selection is used for practice and theory. Split is a register heuristic. */
export function selectHandMidi(
  midi: ParsedMidi, assignments: Record<number, HandAssignment>, hand: ActiveHand, splitPoint = 60,
): ParsedMidi {
  return { ...midi, tracks: midi.tracks.filter((t) => !t.isPercussion).map((track) => {
    const assignment = assignments[track.index] ?? 'none';
    const notes = track.notes.filter((note) => {
      if (assignment === 'none') return false;
      if (hand === 'both') return true;
      if (assignment === 'split') return hand === 'left' ? note.midi < splitPoint : note.midi >= splitPoint;
      return assignment === hand;
    });
    return { ...track, notes };
  }).filter((track) => track.notes.length > 0) };
}
