import { Midi } from '@tonejs/midi';
import { Note } from '@tonaljs/tonal';
import type { MidiMeasure, MidiNote, ParsedMidi, ParsedTrack } from '../store/practiceStore';

/**
 * Parse a MIDI ArrayBuffer into our internal ParsedMidi format.
 */
export function parseMidi(buffer: ArrayBuffer): ParsedMidi {
  const midi = new Midi(buffer);

  // ── Tempo ──────────────────────────────────────────────────────────────
  const tempos = midi.header.tempos;
  const tempo = tempos.length > 0 ? tempos[0].bpm : 120;

  // ── Time Signature ─────────────────────────────────────────────────────
  const timeSigs = midi.header.timeSignatures;
  const timeSignature: [number, number] =
    timeSigs.length > 0
      ? [timeSigs[0].timeSignature[0], timeSigs[0].timeSignature[1]]
      : [4, 4];

  // ── Duration ───────────────────────────────────────────────────────────
  const durationSeconds = midi.duration;
  const totalBeats = Math.ceil(midi.durationTicks / midi.header.ppq);
  // Build the measure grid in MIDI ticks, then convert through the tempo map.
  const signatures = [...timeSigs].sort((a, b) => a.ticks - b.ticks);
  const measures: MidiMeasure[] = [];
  let tick = 0;
  let signatureIndex = -1;
  let signature: [number, number] = [4, 4];
  while (tick < midi.durationTicks) {
    while (signatures[signatureIndex + 1]?.ticks <= tick) {
      signatureIndex++;
      signature = [...signatures[signatureIndex].timeSignature] as [number, number];
    }
    const beatTicks = midi.header.ppq * 4 / signature[1];
    const nextChange = signatures[signatureIndex + 1]?.ticks ?? Infinity;
    const endTick = Math.min(tick + signature[0] * beatTicks, nextChange, midi.durationTicks);
    const beatTimes: number[] = [];
    for (let beat = tick; beat < endTick; beat += beatTicks) {
      beatTimes.push(midi.header.ticksToSeconds(beat));
    }
    measures.push({ number: measures.length + 1, startTime: midi.header.ticksToSeconds(tick),
      endTime: midi.header.ticksToSeconds(endTick), beatTimes, timeSignature: signature });
    tick = endTick;
  }

  // ── Tracks ─────────────────────────────────────────────────────────────
  const tracks: ParsedTrack[] = midi.tracks
    .filter((t) => t.notes.length > 0) // skip empty/meta tracks
    .map((track, index) => {
      const notes: MidiNote[] = track.notes.map((note) => ({
        name: note.name,       // e.g. "C4", "F#3"
        time: note.time,
        duration: note.duration,
        midi: note.midi,
        velocity: note.velocity,
        trackIndex: index,
      }));

      return {
        index,
        name: track.name || `Track ${index + 1}`,
        notes,
        isPercussion: track.channel === 9,
      };
    });

  return { tracks, tempo, timeSignature, totalBeats, durationSeconds, measures,
    keySignatures: midi.header.keySignatures.filter((key) => key.key).map((key) => ({
      // Tone names the key signature by its major tonic, even for minor keys.
      key: key.scale === 'minor' ? Note.transpose(key.key, '-3m') : key.key,
      scale: key.scale, time: midi.header.ticksToSeconds(key.ticks),
    })),
  };
}

/**
 * Returns the notes in segment [segmentIndex] of [beatsPerSegment] beats.
 */
export function getSegmentNotes(
  notes: MidiNote[],
  tempo: number,
  beatsPerSegment: number,
  segmentIndex: number,
): MidiNote[] {
  const beatDuration = 60 / tempo;
  const segDuration = beatsPerSegment * beatDuration;
  const startTime = segmentIndex * segDuration;
  const endTime = startTime + segDuration;

  return notes
    .filter((n) => n.time >= startTime && n.time < endTime)
    .sort((a, b) => a.time - b.time);
}

/**
 * Total number of segments (of beatsPerSegment beats) in the piece.
 */
export function totalSegments(
  totalBeats: number,
  beatsPerSegment: number,
): number {
  return Math.max(1, Math.ceil(totalBeats / beatsPerSegment));
}

/**
 * Format segment label, e.g. "Compás 1 · ♩1–4"
 */
export function segmentLabel(
  segmentIndex: number,
  beatsPerSegment: number,
  timeSignature: [number, number],
): string {
  const beatsPerMeasure = timeSignature[0];
  const firstBeat = segmentIndex * beatsPerSegment + 1;
  const lastBeat = firstBeat + beatsPerSegment - 1;
  const measure = Math.ceil(firstBeat / beatsPerMeasure);
  return `Compás ${measure} · ♩${firstBeat}–${lastBeat}`;
}
