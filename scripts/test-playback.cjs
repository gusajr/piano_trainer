const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { buildPlaybackPlan, playbackFrame, startPlaybackTimeline } = require('../src/services/playbackTimeline.ts');
const note = (midi, time, duration) => ({ midi, name: `note-${midi}`, time, duration, velocity: 1, trackIndex: 0 });
const original = [note(64, 10.5, 1), note(60, 10.5, 0.2), note(67, 12, 5)];
const plan = buildPlaybackPlan(original, 10, 13);
assert.equal(plan.duration, 2.5);
assert.deepEqual(plan.notes.map((n) => [n.midi, n.time, Number(n.duration.toFixed(6))]), [[60, 0, 0.2], [64, 0, 1], [67, 1.5, 1]]);
assert.equal(original[2].duration, 5);
assert.deepEqual(playbackFrame(plan.notes, 0).activeIndices, [0, 1]); // Leading silence is skipped.
assert.deepEqual(playbackFrame(plan.notes, 0.9).activeIndices, [1]); // Sustain survives next note's end.
assert.deepEqual(playbackFrame(plan.notes, 1.2).activeIndices, []); // Rest inside the phrase is preserved.
assert.deepEqual(playbackFrame(plan.notes, 3).activeIndices, []);
assert.equal(playbackFrame(plan.notes, 3).lastStartedIndex, 2);
assert.deepEqual(buildPlaybackPlan([]), { notes: [], duration: 0 });
assert.equal(buildPlaybackPlan(original).duration, 6.5);

function fakeClock() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    now: () => now / 1000,
    schedule: (callback, delay) => { const key = ++id; timers.set(key, { callback, at: now + delay }); return key; },
    cancel: (key) => timers.delete(key),
    advance: (milliseconds) => {
      const target = now + milliseconds;
      while (true) {
        const next = [...timers].filter(([, value]) => value.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].callback();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}
const clock = fakeClock();
const played = [], progress = [];
let completed = 0;
const callbacks = { onNote: (n) => played.push(n.midi), onProgress: (t) => progress.push(t), onComplete: () => completed++ };
const stop = startPlaybackTimeline(plan, callbacks, clock);
clock.advance(0); assert.deepEqual(played, [60, 64]);
clock.advance(300); stop(); stop();
clock.advance(5000);
assert.deepEqual(played, [60, 64]); // Stop must cancel future audio, not just the cursor.
assert.equal(completed, 0);
assert.equal(clock.pending(), 0);
played.length = 0; progress.length = 0;
startPlaybackTimeline(plan, callbacks, clock);
assert.equal(progress[0], 0); // Replay starts at the beginning.
clock.advance(3000);
assert.deepEqual(played, [60, 64, 67]);
assert.equal(completed, 1);
assert.equal(progress.at(-1), 2.5);
assert.equal(clock.pending(), 0);
assert(progress.every((value, i) => i === 0 || value >= progress[i - 1]));
const delayed = buildPlaybackPlan([note(60, 10, 0.5), note(64, 11, 0.5)], 0, 12);
assert.equal(delayed.notes[0].time, 0);
assert.equal(delayed.notes[1].time, 1);
assert.equal(delayed.duration, 2);
console.log('Playback checks passed: chords, sustained notes, rests, clipping, shared timing, stop and complete replay.');
