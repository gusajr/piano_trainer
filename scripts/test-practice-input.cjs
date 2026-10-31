const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  });
  module._compile(outputText, filename);
};
const { usePracticeStore: store } = require('../src/store/practiceStore.ts');
const note = (midi, time) => ({ midi, name: {60:'C4',64:'E4',67:'G4'}[midi], time, duration: 0.2, velocity: 1, trackIndex: 0 });
const notes = [note(60,0), note(64,0), note(60,1), note(64,1), note(67,2)];
let hooks = [], cursor = 0;
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useRef: (value) => { const i = cursor++; return hooks[i] ??= { current: value }; },
  useState: (value) => { const i = cursor++; hooks[i] ??= { value }; return [hooks[i].value, (v) => { hooks[i].value = v; }]; },
  useEffect() {}, useCallback: (fn) => fn,
};
const originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === 'react') return React;
  if (request === 'react-native') return { View:'View', Text:'Text', TouchableOpacity:'Button', ScrollView:'Scroll',
    StyleSheet:{ create:x=>x }, useWindowDimensions:()=>({width:390,height:844}) };
  if (request === 'expo-router') return { router:{ back(){}, push(){} } };
  if (request === '../store/practiceStore') return { usePracticeStore: Object.assign(() => store.getState(), {getState:store.getState}) };
  if (request === '../services/audioEngine') return { playNote:async()=>{}, playSequence:async()=>{} };
  if (request.startsWith('../components/')) return { __esModule:true, default:request.split('/').at(-1) };
  return originalLoad.call(this, request, ...args);
};
const Screen = require('../src/app/practice.tsx').default;
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return;
  if (tree.type === type) return tree;
  for (const child of (tree.props?.children ?? []).flat(Infinity)) { const match = find(child,type); if (match) return match; }
}
function render() { cursor=0; return Screen(); }
function reset() {
  hooks=[];
  store.setState({midiData:{tempo:120}, segmentNotes:notes, currentNoteIndex:0, answers:[], practiceMode:'A'});
}
const tap = (name) => find(render(),'PianoKeyboard').props.onNotePress(name);
try {
  reset(); tap('C4');
  assert.equal(store.getState().currentNoteIndex,0);
  tap('C4'); assert.equal(store.getState().currentNoteIndex,0); // Repeated pitch is not a second target.
  tap('E4'); assert.equal(store.getState().currentNoteIndex,2);
  tap('E4'); assert.equal(store.getState().currentNoteIndex,2); // Identical following chord needs new notes.
  tap('C4'); assert.equal(store.getState().currentNoteIndex,4);
  tap('G4'); assert.equal(store.getState().currentNoteIndex,5);
  assert.deepEqual(store.getState().answers,[true,true,true,true,true]);
  reset();
  let keyboard=find(render(),'PianoKeyboard').props;
  keyboard.onNoteDown('C4'); keyboard.onNoteDown('C4'); keyboard.onNoteDown('E4');
  assert.equal(store.getState().currentNoteIndex,0);
  keyboard.onNoteUp('C4'); assert.equal(store.getState().currentNoteIndex,0);
  keyboard.onNoteUp('E4'); keyboard.onNoteUp('E4');
  assert.equal(store.getState().currentNoteIndex,2);
  reset(); tap('D4'); tap('C4'); tap('E4');
  assert.equal(store.getState().currentNoteIndex,2);
  assert.deepEqual(store.getState().answers,[false,false]);
  console.log('Practice screen input passed: separate clicks, reverse order, repeated chords, multitouch, duplicate events and error correction.');
} finally { Module._load=originalLoad; }
