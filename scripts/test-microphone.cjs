const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { detectPitches, PitchGate } = require('../src/services/pitchDetection.ts');
const { evaluateExternalNotes } = require('../src/services/externalPractice.ts');
const wave = (notes, rate=48000, harmonics=false) => Float32Array.from({length:16384}, (_,i) => notes.reduce((sum,midi) => {
  const phase = 2*Math.PI*440*2**((midi-69)/12)*i/rate;
  return sum + (Math.sin(phase) + (harmonics ? .6*Math.sin(phase*2)+.3*Math.sin(phase*3)+.2*Math.sin(phase*4) : 0))*.1;
},0));
for (const rate of [44100,48000]) for (const pitch of [21,24,36,37,48,60,61,64,69,72,84,96,108]) {
  assert.deepEqual(detectPitches(wave([pitch],rate,true),rate).midi,[pitch], `harmonic pitch ${pitch} at ${rate}`);
}
for (const chord of [[60,64],[60,64,67],[48,55,64],[61,65,68]]) {
  assert.deepEqual(detectPitches(wave(chord),48000).midi.sort((a,b)=>a-b),chord);
}
assert.deepEqual(detectPitches(new Float32Array(16384),48000).midi,[]);
assert.deepEqual(detectPitches(new Float32Array(16384).fill(.3),48000).midi,[]); // DC offset isn't a note.
assert.deepEqual(detectPitches(wave([60]).map(x=>x*.001),48000).midi,[]);
let seed=1234;
const noise=Float32Array.from({length:16384},()=>{seed=(seed*1664525+1013904223)>>>0;return (seed/2**32-.5)*.2;});
assert.deepEqual(detectPitches(noise,48000).midi,[]);
const gate=new PitchGate();
assert.deepEqual(gate.update([60],0),[]);
assert.deepEqual(gate.update([60],80),[0]);
assert.deepEqual(gate.update([72],160),[]); // Octave changes don't create repeated attacks.
assert.deepEqual(gate.update([60],1000),[]); // Sustain cannot complete repeated MIDI targets.
gate.update([],1100); gate.update([],1300);
assert.deepEqual(gate.update([48],1400),[]);
assert.deepEqual(gate.update([48],1480),[0]);
assert.deepEqual(gate.update([48,64],1560),[]);
assert.deepEqual(gate.update([48,64],1640),[4]);
const target=[{midi:60},{midi:64}];
const first=evaluateExternalNotes(target,[36],new Set());
assert.equal(first.result,'waiting');
assert.deepEqual([...first.matched],[60]);
assert.equal(evaluateExternalNotes(target,[52],first.matched).result,'correct');
assert.equal(evaluateExternalNotes(target,[48,76],new Set()).result,'correct');
assert.equal(evaluateExternalNotes(target,[61],new Set()).result,'wrong');
assert.equal(evaluateExternalNotes([{midi:48},{midi:60},{midi:72}],[36],new Set()).result,'correct');
assert.equal(evaluateExternalNotes(target,[],new Set()).result,'waiting');
for (let pitch=0; pitch<12; pitch++) for (let octave=1; octave<=8; octave++) {
  assert.equal(evaluateExternalNotes([{midi:60+pitch}],[(octave+1)*12+pitch],new Set()).result,'correct');
  assert.equal(evaluateExternalNotes([{midi:60+pitch}],[(octave+1)*12+(pitch+1)%12],new Set()).result,'wrong');
}

// Exercise the real browser capture service without accessing a physical microphone.
const { startMicrophone }=require('../src/services/microphoneCapture.web.ts');
const oldWindow=global.window, oldNavigator=Object.getOwnPropertyDescriptor(global,'navigator');
let stopped=0, closed=0, ended, resolvePermission;
class Context {
  state='running'; sampleRate=48000;
  async resume() {}
  async close() { closed++; }
  addEventListener() {}
  createAnalyser() { return {fftSize:16384,getFloatTimeDomainData(buffer){buffer.fill(0);}}; }
  createMediaStreamSource() { return {connect(){},disconnect(){}}; }
}
const stream={getTracks:()=>[{stop(){stopped++;},addEventListener(_,callback){ended=callback;}}]};
global.window={isSecureContext:true,AudioContext:Context};
Object.defineProperty(global,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{resolvePermission=resolve;})}}});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
(async()=>{
  const errors=[];let ready=0, stopCount=0;
  const callbacks={onReady(){ready++;},onFrame(){},onNotes(){},onStop(){stopCount++;},onError(error){errors.push(error);}};
  const stop=startMicrophone(callbacks,.008);
  await flush(); stop(); resolvePermission(stream); await flush();
  assert.equal(ready,0); assert.equal(stopped,1); assert.equal(closed,1); assert.equal(stopCount,1);
  const stop2=startMicrophone(callbacks,.008);
  await flush(); resolvePermission(stream); await flush();
  assert.equal(ready,1); ended(); stop2();
  assert.equal(stopped,2); assert.equal(closed,2);
  navigator.mediaDevices.getUserMedia=async()=>{const error=new Error('denied');error.name='NotAllowedError';throw error;};
  startMicrophone(callbacks,.008); await flush();
  assert(errors.at(-1).includes('Permite'));
  window.isSecureContext=false;
  startMicrophone(callbacks,.008); await flush();
  assert(errors.at(-1).includes('HTTPS'));
  console.log('Microphone checks passed: pitches, harmonics, chords, noise, octave equivalence, stable attacks, permissions and resource cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
  global.window=oldWindow;
  if(oldNavigator)Object.defineProperty(global,'navigator',oldNavigator);else delete global.navigator;
});
