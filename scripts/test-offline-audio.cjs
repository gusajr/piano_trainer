const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Note } = require('@tonaljs/tonal');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/piano-manifest.json');

assert.equal(manifest.samples.length, 88);
assert.deepEqual(manifest.samples.map((s) => s.midi), Array.from({ length: 88 }, (_, i) => 21 + i));
for (const sample of manifest.samples) {
  assert.match(sample.filename, /^[a-z0-9_]+\.mp3$/); // Valid Android raw resource name.
  const bytes = fs.readFileSync(path.join(root, 'assets/piano', sample.filename));
  assert.equal(bytes.length, sample.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sample.sha256);
  assert(bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224));
}
assert.equal(fs.readdirSync(path.join(root, 'assets/piano')).length, 88);
const assetPlugin = require('../app.json').expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-asset');
assert(assetPlugin[1].assets.includes('./assets/piano'));
for (const file of ['src/services/audioEngine.ts', 'App.tsx']) {
  assert(!/https?:\/\//.test(fs.readFileSync(path.join(root, file), 'utf8')), `${file} still refers to a remote sound`);
}

// Exercise the actual engine with Metro asset IDs and device/audio APIs stubbed.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
require.extensions['.mp3'] = (module, filename) => {
  const entry = manifest.samples.find((s) => s.filename === path.basename(filename));
  assert(entry);
  module.exports = entry.midi; // Numeric static asset ID, as on native Metro.
};
const originalLoad = Module._load;
const originalTimeout = global.setTimeout;
let platform = 'ios';
const played = [];
const scheduled = [];
let samplerCount = 0;
let samplerUrls;
class Instrument {
  volume = {};
  toDestination() { return this; }
  triggerAttackRelease(...args) { played.push(args); }
  releaseAll() {}
}
Module._load = function (request, ...rest) {
  if (request === 'react-native') return { Platform: { OS: platform } };
  if (request === 'expo-asset') return { Asset: { fromModule: (id) => ({ uri: `/assets/piano/${id}.mp3` }) } };
  if (request === 'expo-audio') return { createAudioPlayer: (source) => {
    assert.equal(typeof source, 'number');
    return { play: () => played.push(source), remove() {}, pause() {} };
  } };
  if (request === 'tone') return {
    PolySynth: Instrument, Synth: Instrument,
    Sampler: class extends Instrument {
      constructor(options) { super(); samplerCount++; samplerUrls = options.urls; options.onload(); }
    },
    context: { state: 'running' }, now: () => 10,
  };
  return originalLoad.call(this, request, ...rest);
};
global.setTimeout = (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; };

(async () => {
  try {
    const filename = require.resolve('../src/services/audioEngine.ts');
    const native = require(filename);
    await native.playNote('C4');
    await native.playNote('Db4');
    await native.playNote('A0');
    await native.playNote('C8');
    assert.deepEqual(played, [60, 61, 21, 108]);
    native.stopAll();
    delete require.cache[filename];
    platform = 'web';
    played.length = 0;
    const web = require(filename);
    await Promise.all([web.initAudioEngine(), web.initAudioEngine()]);
    assert.equal(samplerCount, 1);
    assert.equal(Object.keys(samplerUrls).length, 88);
    for (const [note, uri] of Object.entries(samplerUrls)) {
      assert.notEqual(Note.midi(note), null);
      assert(uri.startsWith('/assets/piano/'));
    }
    await web.playNote('F#4');
    await web.playSequence([{ name: 'C4', time: 0, duration: 0.6 }, { name: 'E4', time: 0.3, duration: 0.2 }], 100);
    assert.deepEqual(played, [['F#4', '2n'], ['C4', 0.6, 10], ['E4', 0.2, 10.3]]);
    console.log('Offline audio checks passed: 88 intact samples, native local assets, web local sampler, single initialization.');
  } finally {
    Module._load = originalLoad;
    global.setTimeout = originalTimeout;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
