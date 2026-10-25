import type { MidiNote } from '../store/practiceStore';

export interface PlaybackPlan { notes: MidiNote[]; duration: number }

export function buildPlaybackPlan(notes: MidiNote[], startTime?: number, endTime?: number): PlaybackPlan {
  if (!notes.length) return { notes: [], duration: 0 };
  const ordered = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
  const requestedStart = startTime ?? ordered[0].time;
  const end = endTime ?? ordered.reduce((last, n) => Math.max(last, n.time + n.duration), requestedStart);
  const firstAudible = ordered.find((n) => n.time < end && n.time + n.duration > requestedStart);
  const start = Math.max(requestedStart, firstAudible?.time ?? requestedStart);
  return { duration: Math.max(0, end - start), notes: ordered
    .filter((n) => n.time < end && n.time + n.duration > start)
    .map((n) => ({ ...n, time: Math.max(start, n.time) - start,
      duration: Math.min(n.time + n.duration, end) - Math.max(n.time, start) })) };
}

export function playbackFrame(notes: MidiNote[], time: number) {
  const activeIndices: number[] = [];
  let lastStartedIndex = -1;
  notes.forEach((note, index) => {
    if (note.time <= time + 1e-7) {
      lastStartedIndex = index;
      if (note.time + note.duration > time + 1e-7) activeIndices.push(index);
    }
  });
  return { activeIndices, lastStartedIndex };
}

export interface PlaybackClock {
  now: () => number; // monotonic seconds
  schedule: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
}
const clock: PlaybackClock = {
  now: () => performance.now() / 1000,
  schedule: (callback, milliseconds) => setTimeout(callback, milliseconds),
  cancel: (timer) => clearTimeout(timer),
};

/** Audio events and visual progress share one start time; stopping cancels future notes. */
export function startPlaybackTimeline(plan: PlaybackPlan, callbacks: {
  onNote: (note: MidiNote) => void;
  onProgress: (seconds: number) => void;
  onComplete: () => void;
}, timer: PlaybackClock = clock): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let stopped = false;
  const start = timer.now();
  const schedule = (callback: () => void, milliseconds: number) => {
    const id = timer.schedule(() => { timers.delete(id); if (!stopped) callback(); }, milliseconds);
    timers.add(id);
  };
  const stop = () => { stopped = true; timers.forEach(timer.cancel); timers.clear(); };
  const progress = () => {
    callbacks.onProgress(Math.min(plan.duration, Math.max(0, timer.now() - start)));
    schedule(progress, 33);
  };
  plan.notes.forEach((note) => schedule(() => callbacks.onNote(note), Math.max(0, note.time * 1000)));
  callbacks.onProgress(0);
  schedule(progress, 33);
  schedule(() => {
    stop();
    callbacks.onProgress(plan.duration);
    callbacks.onComplete();
  }, plan.duration * 1000);
  return stop;
}
