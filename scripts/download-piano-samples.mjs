import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const directory = new URL('assets/piano/', root);
const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const pitches = Array.from({ length: 88 }, (_, i) => i + 21);
await mkdir(directory, { recursive: true });
let previous;
try { previous = JSON.parse(await readFile(new URL('assets/piano-manifest.json', root), 'utf8')); } catch { /* First download. */ }
let sha = previous?.revision;
if (!sha) {
  const revisionResponse = await fetch('https://api.github.com/repos/fuhton/piano-mp3/commits/master');
  if (!revisionResponse.ok) throw new Error(`Cannot resolve sample revision: ${revisionResponse.status}`);
  ({ sha } = await revisionResponse.json());
}
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid source revision');
const base = `https://raw.githubusercontent.com/fuhton/piano-mp3/${sha}/`;
function isMp3(bytes) {
  return bytes.length > 1000 && (bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224));
}
const entries = [];
let cursor = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < pitches.length) {
    const midi = pitches[cursor++];
    const sourceFilename = `${names[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;
    const filename = sourceFilename.toLowerCase(); // Android raw resources require lowercase names.
    const target = new URL(filename, directory);
    let bytes;
    try { bytes = await readFile(target); } catch { /* Missing samples are downloaded below. */ }
    const expectedHash = previous?.samples?.find((sample) => sample.midi === midi)?.sha256;
    if (!bytes || !isMp3(bytes) || (expectedHash && createHash('sha256').update(bytes).digest('hex') !== expectedHash)) {
      const response = await fetch(`${base}piano-mp3/${sourceFilename}`, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (!isMp3(bytes)) throw new Error(`${filename} is not a valid MP3`);
      await writeFile(target, bytes);
    }
    entries.push({ midi, filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}));
entries.sort((a, b) => a.midi - b.midi);
const license = await fetch(`${base}LICENSE`);
if (!license.ok) throw new Error(`License: HTTP ${license.status}`);
await writeFile(new URL('assets/piano.LICENSE.txt', root), await license.text());
await writeFile(new URL('assets/piano-manifest.json', root), JSON.stringify({
  source: 'https://github.com/fuhton/piano-mp3', revision: sha, samples: entries,
}, null, 2) + '\n');
const mapping = `// Bundled piano samples. Regenerate with: node scripts/download-piano-samples.mjs\n` +
  `// Static requires let Metro include every sample in Android, iOS and web builds.\n` +
  `export const PIANO_SAMPLES: Record<number, number> = {\n` +
  entries.map((s) => `  ${s.midi}: require('../../assets/piano/${s.filename}'),`).join('\n') + '\n};\n';
await writeFile(new URL('src/services/pianoSamples.ts', root), mapping);
console.log(`Saved ${entries.length} piano samples (${(entries.reduce((sum, s) => sum + s.bytes, 0) / 1024 / 1024).toFixed(2)} MB) to ${fileURLToPath(directory)}`);
