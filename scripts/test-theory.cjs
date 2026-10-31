const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { Midi } = require('@tonejs/midi');

// Run the pure TypeScript services without adding a test runtime dependency.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { parseMidi } = require('../src/services/midiParser.ts');
const { analyzeSong } = require('../src/services/songAnalysis.ts');
const { selectHandMidi } = require('../src/services/handSelection.ts');
const { explainTheory } = require('../src/services/theoryExplainer.ts');
const { usePracticeStore } = require('../src/store/practiceStore.ts');
const { practiceChord, evaluateChordProgress } = require('../src/services/practiceChord.ts');
const parse = (midi) => parseMidi(Uint8Array.from(midi.toArray()).buffer);

const midi = new Midi();
midi.header.tempos = [{ ticks: 0, bpm: 120 }, { ticks: 1920, bpm: 60 }];
midi.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }, { ticks: 3840, timeSignature: [3, 4] }];
midi.header.update();
const track = midi.addTrack();
for (const pitch of [60, 64, 67]) track.addNote({ midi: pitch, ticks: 0, durationTicks: 960 });
for (const [i, pitch] of [60, 64, 67, 72].entries()) track.addNote({ midi: pitch, ticks: 1920 + i * 480, durationTicks: 400 });
track.addNote({ midi: 60, ticks: 3840, durationTicks: 1440 });
const data = parse(midi);
assert.equal(data.measures.length, 3);
assert.equal(data.measures[1].startTime, 2);
assert.equal(data.measures[2].startTime, 6);
assert.deepEqual(data.measures[2].timeSignature, [3, 4]);
const song = analyzeSong(data);
assert(song.measures[0].harmonies.some((h) => h.symbol === 'CM' && h.kind === 'Acorde'));
assert(song.measures[1].harmonies.some((h) => h.symbol === 'CM' && h.kind === 'Posible arpegio'));
assert(!song.measures[0].harmonies.some((h) => h.kind === 'Posible arpegio'));
assert(!song.measures[2].harmonies.length);

const blocks = new Midi();
const blocksTrack = blocks.addTrack();
for (const ticks of [0, 480, 960]) {
  for (const pitch of [60, 64, 67]) blocksTrack.addNote({ midi: pitch, ticks, durationTicks: 400 });
}
assert.equal(analyzeSong(parse(blocks)).arpeggios.length, 0);

const compound = new Midi();
compound.header.timeSignatures = [{ ticks: 0, timeSignature: [6, 8] }];
compound.header.keySignatures = [{ ticks: 0, key: 'C', scale: 'minor' }];
compound.header.update();
compound.addTrack().addNote({ midi: 60, ticks: 0, durationTicks: 2880 });
// Tone's encoder offsets key signatures incorrectly; encode the standard -3 flats explicitly.
const midiFile = require('midi-file');
const raw = midiFile.parseMidi(compound.toArray());
raw.tracks.flat().find((event) => event.type === 'keySignature').key = -3;
const compoundData = parseMidi(Uint8Array.from(midiFile.writeMidi(raw)).buffer);
assert.equal(compoundData.measures.length, 2);
assert.equal(compoundData.measures[0].beatTimes.length, 6);
assert.equal(compoundData.measures[1].startTime, 1.5);
assert(analyzeSong(compoundData).key.declared[0].startsWith('C menor'));

const sustained = new Midi();
for (const pitch of [60, 64, 67]) sustained.addTrack().addNote({ midi: pitch, ticks: 0, durationTicks: 2400 });
const held = analyzeSong(parse(sustained));
assert(held.measures[1].harmonies.some((h) => h.symbol === 'CM'));
assert.deepEqual(analyzeSong({ ...data, tracks: [] }).key.notes, []);
assert.deepEqual(analyzeSong({ ...data, tracks: data.tracks.map((t) => ({ ...t, isPercussion: true })) }).chords, []);

// Major and relative minor share pitches: duration profiles must separate them.
const tonal = new Midi();
const melody = tonal.addTrack();
for (const [i, pitch] of [60, 62, 64, 65, 67, 69, 71, 60, 64, 67, 60].entries()) {
  melody.addNote({ midi: pitch, ticks: i * 960, durationTicks: [60, 64, 67].includes(pitch) ? 900 : 120 });
}
assert.equal(analyzeSong(parse(tonal)).key.name, 'C mayor');

// Hand filtering must feed both practice and theory with the same notes.
const hands = new Midi();
const low = hands.addTrack();
const high = hands.addTrack();
for (const pitch of [48, 52, 55]) low.addNote({ midi: pitch, ticks: 0, durationTicks: 960 });
for (const pitch of [62, 65, 69]) high.addNote({ midi: pitch, ticks: 0, durationTicks: 960 });
const handsData = parse(hands);
const assignments = { 0: 'left', 1: 'right' };
assert(analyzeSong(selectHandMidi(handsData, assignments, 'left')).chords.includes('CM'));
assert(!analyzeSong(selectHandMidi(handsData, assignments, 'left')).chords.includes('Dm'));
assert(analyzeSong(selectHandMidi(handsData, assignments, 'right')).chords.includes('Dm'));
assert.equal(selectHandMidi(handsData, assignments, 'both').tracks.length, 2);
assert.equal(selectHandMidi(handsData, { 0: 'none', 1: 'right' }, 'left').tracks.length, 0);
const mixedData = { ...handsData, tracks: [{ index: 0, name: 'Both hands', notes: [...handsData.tracks[0].notes, ...handsData.tracks[1].notes] }] };
assert.deepEqual(selectHandMidi(mixedData, { 0: 'split' }, 'left').tracks[0].notes.map((n) => n.midi), [48, 52, 55]);
assert.deepEqual(selectHandMidi(mixedData, { 0: 'split' }, 'right').tracks[0].notes.map((n) => n.midi), [62, 65, 69]);
assert.equal(selectHandMidi(mixedData, { 0: 'split' }, 'left', 65).tracks[0].notes.length, 4);

// Harmonic thirds must not be reported as melodic jumps through a chord.
const intervals = analyzeSong(selectHandMidi(handsData, assignments, 'left')).measures[0].intervals;
assert(intervals.some((i) => i.kind === 'Armónico' && i.semitones === 4));
assert(!intervals.some((i) => i.kind === 'Melódico'));
const steps = new Midi();
const voice = steps.addTrack();
for (const [i, pitch] of [60, 64, 62].entries()) voice.addNote({ midi: pitch, ticks: i * 1920, durationTicks: 480 });
const stepAnalysis = analyzeSong(parse(steps));
assert(stepAnalysis.measures[1].intervals.some((i) => i.kind === 'Melódico' && i.semitones === 4));
assert(stepAnalysis.measures[2].intervals.some((i) => i.kind === 'Melódico' && i.semitones === -2));
const maj7 = explainTheory({ kind: 'chord', value: 'Cmaj7' });
assert(maj7.paragraphs.some((p) => p.includes('1–3–5–7')));
assert(maj7.paragraphs.some((p) => p.includes('0 · 4 · 7 · 11')));
assert(explainTheory({ kind: 'chord', value: 'Cm/Eb' }).paragraphs.some((p) => p.includes('Eb es la nota más grave')));
assert(explainTheory({ kind: 'scale', value: 'C menor armónica' }).paragraphs.some((p) => p.includes('Si')));
assert(explainTheory({ kind: 'interval', value: '-3m' }).paragraphs[0].includes('3 semitonos'));
assert.equal(explainTheory({ kind: 'interval', value: '3M', harmonic: true }).title, 'Tercera mayor');

// Regression: 23 targets, two mistakes, still all 23 must be played.
const practice = new Midi();
const practiceTrack = practice.addTrack();
for (let i = 0; i < 23; i++) practiceTrack.addNote({ midi: 60 + i % 12, ticks: i * 60, durationTicks: 48 });
usePracticeStore.getState().loadMidi(parse(practice), '23-notes.mid');
assert.equal(usePracticeStore.getState().segmentNotes.length, 23);
for (let i = 0; i < 23; i++) {
  if (i === 3 || i === 22) {
    usePracticeStore.getState().recordAnswer(false);
    usePracticeStore.getState().recordAnswer(false);
    assert.equal(usePracticeStore.getState().currentNoteIndex, i);
    assert.equal(usePracticeStore.getState().answers.length, i + 1);
  }
  usePracticeStore.getState().recordAnswer(true);
  assert.equal(usePracticeStore.getState().currentNoteIndex, i + 1);
}
assert.equal(usePracticeStore.getState().answers.length, 23);
assert.equal(usePracticeStore.getState().answers.filter(Boolean).length, 21);
usePracticeStore.getState().recordAnswer(true);
assert.equal(usePracticeStore.getState().currentNoteIndex, 23);
usePracticeStore.getState().resetSession();
assert.equal(usePracticeStore.getState().currentNoteIndex, 0);
assert.deepEqual(usePracticeStore.getState().answers, []);
usePracticeStore.getState().loadMidi(mixedData, 'mixed.mid');
usePracticeStore.getState().setActiveHand('left');
assert.deepEqual(usePracticeStore.getState().segmentNotes.map((n) => n.midi), [48, 52, 55]);
usePracticeStore.getState().setSplitPoint(65);
assert.equal(usePracticeStore.getState().segmentNotes.length, 4);
usePracticeStore.getState().setActiveHand('both');
assert.equal(usePracticeStore.getState().segmentNotes.length, 6);

// A dyad accepts simultaneous notes and accumulated separate taps.
const dyadMidi = new Midi();
const dyadTrack = dyadMidi.addTrack();
for (const midi of [60, 64]) dyadTrack.addNote({ midi, ticks: 0, durationTicks: 480 });
dyadTrack.addNote({ midi: 67, ticks: 480, durationTicks: 480 });
usePracticeStore.getState().loadMidi(parse(dyadMidi), 'dyad.mid');
const dyad = practiceChord(usePracticeStore.getState().segmentNotes, 0);
assert.equal(dyad.length, 2);
assert.equal(evaluateChordProgress(dyad, new Set([60])), 'waiting');
assert.equal(evaluateChordProgress(dyad, new Set([64])), 'waiting');
assert.equal(evaluateChordProgress(dyad, new Set([60, 64])), 'correct');
assert.equal(evaluateChordProgress(dyad, new Set([60, 64, 61])), 'wrong');
assert.equal(evaluateChordProgress([dyad[0], dyad[0]], new Set([60])), 'correct'); // Unison needs one physical key.
// Releasing the first note preserves progress; order and repeated taps do not matter.
const playedSeparately = new Set([64]);
assert.equal(evaluateChordProgress(dyad, new Set([64]), playedSeparately), 'waiting');
assert.equal(evaluateChordProgress(dyad, new Set(), playedSeparately), 'waiting');
assert.equal(evaluateChordProgress(dyad, new Set([64]), playedSeparately), 'waiting');
playedSeparately.add(60);
assert.equal(evaluateChordProgress(dyad, new Set([60]), playedSeparately), 'correct');
assert.equal(evaluateChordProgress(dyad, new Set(), playedSeparately), 'correct');
assert.equal(evaluateChordProgress(dyad, new Set([61]), playedSeparately), 'wrong');
// A following chord starts with fresh progress, even when it has the same pitches.
assert.equal(evaluateChordProgress(dyad, new Set([60]), new Set([60])), 'waiting');
usePracticeStore.getState().recordChordAnswer(false);
assert.equal(usePracticeStore.getState().currentNoteIndex, 0);
usePracticeStore.getState().recordChordAnswer(true);
assert.equal(usePracticeStore.getState().currentNoteIndex, 2);
assert.deepEqual(usePracticeStore.getState().answers, [false, false]);
assert.equal(practiceChord(usePracticeStore.getState().segmentNotes, 2).length, 1);
usePracticeStore.getState().recordChordAnswer(true);
assert.equal(usePracticeStore.getState().currentNoteIndex, 3);
assert.deepEqual(usePracticeStore.getState().answers, [false, false, true]);

// Long songs permit arbitrary fragment lengths up to the final measure.
const longSong = new Midi();
const longTrack = longSong.addTrack();
for (let i = 0; i < 54; i++) longTrack.addNote({ midi: 60, ticks: i * 1920, durationTicks: 480 });
usePracticeStore.getState().loadMidi(parse(longSong), '54-measures.mid');
usePracticeStore.getState().setMeasureCount(54);
assert.equal(usePracticeStore.getState().measureCount, 54);
assert.equal(usePracticeStore.getState().segmentNotes.length, 54);
usePracticeStore.getState().setStartMeasure(50);
assert.equal(usePracticeStore.getState().measureCount, 5);
assert.equal(usePracticeStore.getState().segmentNotes.length, 5);
usePracticeStore.getState().setMeasureCount(999);
assert.equal(usePracticeStore.getState().measureCount, 5);
usePracticeStore.getState().setMeasureCount(3);
assert.equal(usePracticeStore.getState().segmentNotes.length, 3);
usePracticeStore.getState().setStartMeasure(54);
assert.equal(usePracticeStore.getState().measureCount, 1);

if (process.argv[2]) {
  const bytes = fs.readFileSync(process.argv[2]);
  const example = parseMidi(Uint8Array.from(bytes).buffer);
  const result = analyzeSong(example);
  assert.equal(example.tracks.reduce((n, t) => n + t.notes.length, 0), 645);
  assert.equal(result.measures.length, 54);
  assert(result.chords.length > 0);
  assert(result.measures[0].harmonies.some((h) => h.symbol === 'Cm' && h.kind === 'Posible arpegio'));
  console.log(JSON.stringify({ key: result.key, measures: result.measures.length,
    chords: result.chords, arpeggios: result.arpeggios,
    firstMeasures: result.measures.slice(0, 3).map((m) => ({ number: m.measure.number, harmonies: m.harmonies })) }, null, 2));
}
console.log('Theory checks passed.');

