import { create } from 'zustand';
import { selectHandMidi } from '../services/handSelection';
import { practiceChord } from '../services/practiceChord';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MidiNote {
  name: string;       // e.g. "C4", "F#3"
  time: number;       // in seconds
  duration: number;   // in seconds
  midi: number;       // MIDI number 0-127
  velocity: number;   // 0-1
  trackIndex: number;
}

export interface ParsedTrack {
  index: number;
  name: string;
  notes: MidiNote[];
  isPercussion?: boolean;
}

export interface MidiMeasure {
  number: number;
  startTime: number;
  endTime: number;
  beatTimes: number[];
  timeSignature: [number, number];
}

export interface ParsedMidi {
  tracks: ParsedTrack[];
  tempo: number;            // BPM
  timeSignature: [number, number]; // [numerator, denominator]
  totalBeats: number;
  durationSeconds: number;
  measures?: MidiMeasure[];
  keySignatures?: { key: string; scale: string; time: number }[];
}

export type HandAssignment = 'right' | 'left' | 'split' | 'none';
export type PracticeMode = 'A' | 'B';  // A = See & Play, B = Listen & Guess
export type ActiveHand = 'right' | 'left' | 'both';

export interface PracticeStore {
  // ── MIDI ──────────────────────────────────────────────────────────────
  midiData: ParsedMidi | null;
  fileName: string;
  trackAssignments: Record<number, HandAssignment>;
  splitPoint: number;

  // ── Measure Selection ─────────────────────────────────────────────────
  startMeasure: number;       // 1-indexed (e.g. 1)
  measureCount: number;       // Continuous measures to practice (e.g. 1, 2, 4)
  totalMeasures: number;

  // Legacy beat support
  beatsPerSegment: number;
  currentSegmentIndex: number;

  // ── Practice session ──────────────────────────────────────────────────
  activeHand: ActiveHand;
  practiceMode: PracticeMode;
  currentNoteIndex: number;
  answers: boolean[];

  // ── Derived notes ─────────────────────────────────────────────────────
  segmentNotes: MidiNote[];

  // ── Actions ───────────────────────────────────────────────────────────
  loadMidi: (data: ParsedMidi, name: string) => void;
  setTrackAssignment: (trackIndex: number, hand: HandAssignment) => void;
  setSplitPoint: (point: number) => void;
  setStartMeasure: (start: number) => void;
  setMeasureCount: (count: number) => void;
  setBeatsPerSegment: (beats: number) => void;
  setSegmentIndex: (index: number) => void;
  setActiveHand: (hand: ActiveHand) => void;
  setPracticeMode: (mode: PracticeMode) => void;
  recordAnswer: (correct: boolean) => void;
  recordChordAnswer: (correct: boolean) => void;
  resetSession: () => void;
  computeSegmentNotes: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeMeasures(
  midiData: ParsedMidi,
  trackAssignments: Record<number, HandAssignment>,
  activeHand: ActiveHand,
  startMeasure: number, // 1-indexed
  measureCount: number,
  splitPoint = 60,
): MidiNote[] {
  if (!midiData) return [];

  const [num, den] = midiData.timeSignature || [4, 4];
  const beatsPerMeasure = num * (4 / den);
  const secondsPerBeat = 60 / (midiData.tempo || 120);
  const secondsPerMeasure = beatsPerMeasure * secondsPerBeat;

  const startTime = midiData.measures?.[startMeasure - 1]?.startTime ?? (startMeasure - 1) * secondsPerMeasure;
  const endTime = midiData.measures
    ? (midiData.measures[startMeasure + measureCount - 2]?.endTime ?? midiData.durationSeconds)
    : startTime + measureCount * secondsPerMeasure;

  const allNotes: MidiNote[] = [];
  selectHandMidi(midiData, trackAssignments, activeHand, splitPoint).tracks.forEach((track) => {
    track.notes.forEach((note) => {
      if (note.time >= startTime && note.time < endTime) {
        allNotes.push(note);
      }
    });
  });

  return allNotes.sort((a, b) => a.time - b.time);
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  midiData: null,
  fileName: '',
  trackAssignments: {},
  splitPoint: 60,
  startMeasure: 1,
  measureCount: 1,
  totalMeasures: 1,
  beatsPerSegment: 4,
  currentSegmentIndex: 0,
  activeHand: 'right',
  practiceMode: 'A',
  currentNoteIndex: 0,
  answers: [],
  segmentNotes: [],

  loadMidi: (data, name) => {
    const autoAssign: Record<number, HandAssignment> = {};
    const pitched = data.tracks.filter((t) => !t.isPercussion);
    pitched.forEach((t, i) => {
      autoAssign[t.index] = pitched.length === 1 ? 'split' : i === 0 ? 'right' : i === 1 ? 'left' : 'none';
    });

    const [num, den] = data.timeSignature || [4, 4];
    const beatsPerMeasure = num * (4 / den);
    const totalMeasures = data.measures?.length || Math.max(1, Math.ceil(data.totalBeats / beatsPerMeasure));

    const segmentNotes = computeMeasures(data, autoAssign, 'right', 1, 1);
    set({
      midiData: data,
      fileName: name,
      trackAssignments: autoAssign,
      splitPoint: 60,
      startMeasure: 1,
      measureCount: 1,
      totalMeasures,
      beatsPerSegment: beatsPerMeasure,
      currentSegmentIndex: 0,
      activeHand: 'right',
      practiceMode: 'A',
      currentNoteIndex: 0,
      answers: [],
      segmentNotes,
    });
  },

  setTrackAssignment: (trackIndex, hand) => {
    const { midiData, trackAssignments, activeHand, startMeasure, measureCount } = get();
    const updated = { ...trackAssignments, [trackIndex]: hand };
    set({ trackAssignments: updated });
    if (midiData) {
      const notes = computeMeasures(midiData, updated, activeHand, startMeasure, measureCount, get().splitPoint);
      set({ segmentNotes: notes, currentNoteIndex: 0, answers: [] });
    }
  },

  setSplitPoint: (point) => {
    const splitPoint = Math.max(21, Math.min(108, Math.round(point)));
    const { midiData, trackAssignments, activeHand, startMeasure, measureCount } = get();
    set({ splitPoint, currentNoteIndex: 0, answers: [], segmentNotes: midiData
      ? computeMeasures(midiData, trackAssignments, activeHand, startMeasure, measureCount, splitPoint) : [] });
  },

  setStartMeasure: (start) => {
    const { midiData, trackAssignments, activeHand, measureCount, totalMeasures } = get();
    const validStart = Math.max(1, Math.min(totalMeasures, start));
    set({ startMeasure: validStart });
    if (midiData) {
      const notes = computeMeasures(midiData, trackAssignments, activeHand, validStart, measureCount, get().splitPoint);
      set({ segmentNotes: notes, currentNoteIndex: 0, answers: [] });
    }
  },

  setMeasureCount: (count) => {
    const { midiData, trackAssignments, activeHand, startMeasure } = get();
    set({ measureCount: count });
    if (midiData) {
      const notes = computeMeasures(midiData, trackAssignments, activeHand, startMeasure, count, get().splitPoint);
      set({ segmentNotes: notes, currentNoteIndex: 0, answers: [] });
    }
  },

  setBeatsPerSegment: (beats) => {
    const { midiData, trackAssignments, activeHand } = get();
    set({ beatsPerSegment: beats });
    if (midiData) {
      const [num, den] = midiData.timeSignature || [4, 4];
      const beatsPerMeasure = num * (4 / den);
      const measures = Math.max(1, Math.round(beats / beatsPerMeasure));
      const notes = computeMeasures(midiData, trackAssignments, activeHand, 1, measures, get().splitPoint);
      set({ segmentNotes: notes, currentNoteIndex: 0, answers: [] });
    }
  },

  setSegmentIndex: (index) => {
    const { midiData, trackAssignments, activeHand, measureCount } = get();
    const newStart = index * measureCount + 1;
    set({ currentSegmentIndex: index, startMeasure: newStart });
    if (midiData) {
      const notes = computeMeasures(midiData, trackAssignments, activeHand, newStart, measureCount, get().splitPoint);
      set({ segmentNotes: notes, currentNoteIndex: 0, answers: [] });
    }
  },

  setActiveHand: (hand) => {
    const { midiData, trackAssignments, startMeasure, measureCount } = get();
    set({ activeHand: hand });
    if (midiData) {
      const notes = computeMeasures(midiData, trackAssignments, hand, startMeasure, measureCount, get().splitPoint);
      set({ segmentNotes: notes, currentNoteIndex: 0, answers: [] });
    }
  },

  setPracticeMode: (mode) => set({ practiceMode: mode, currentNoteIndex: 0, answers: [] }),

  recordAnswer: (correct) => {
    const { answers, currentNoteIndex, segmentNotes } = get();
    if (currentNoteIndex >= segmentNotes.length) return;
    const updated = [...answers];
    // One result per target note. A corrected note retains its first-attempt error.
    updated[currentNoteIndex] = (answers[currentNoteIndex] ?? true) && correct;
    set({ answers: updated, currentNoteIndex: currentNoteIndex + (correct ? 1 : 0) });
  },

  recordChordAnswer: (correct) => {
    const { answers, currentNoteIndex, segmentNotes } = get();
    const chord = practiceChord(segmentNotes, currentNoteIndex);
    if (!chord.length) return;
    const updated = [...answers];
    chord.forEach((_, offset) => {
      const index = currentNoteIndex + offset;
      updated[index] = (answers[index] ?? true) && correct;
    });
    set({ answers: updated, currentNoteIndex: currentNoteIndex + (correct ? chord.length : 0) });
  },

  resetSession: () => set({ currentNoteIndex: 0, answers: [] }),

  computeSegmentNotes: () => {
    const { midiData, trackAssignments, activeHand, startMeasure, measureCount } = get();
    if (!midiData) return;
    const notes = computeMeasures(midiData, trackAssignments, activeHand, startMeasure, measureCount, get().splitPoint);
    set({ segmentNotes: notes, currentNoteIndex: 0, answers: [] });
  },
}));
