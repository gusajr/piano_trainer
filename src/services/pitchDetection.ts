/** Local spectral analysis. No expected notes are supplied to the detector. */
export function detectPitches(samples: Float32Array, sampleRate: number, minimumRms = 0.008) {
  const size = samples.length;
  if (!size || (size & (size - 1)) || sampleRate <= 0) return { midi: [] as number[], rms: 0 };
  let sum = 0, square = 0;
  for (const sample of samples) { sum += sample; square += sample * sample; }
  const mean = sum / size;
  const rms = Math.sqrt(Math.max(0, square / size - mean * mean));
  if (rms < minimumRms) return { midi: [] as number[], rms };
  const real = new Float64Array(size), imaginary = new Float64Array(size);
  for (let i = 0; i < size; i++) real[i] = (samples[i] - mean) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let length = 2; length <= size; length *= 2) {
    const angle = -2 * Math.PI / length;
    const stepR = Math.cos(angle), stepI = Math.sin(angle);
    for (let offset = 0; offset < size; offset += length) {
      let wr = 1, wi = 0;
      for (let i = 0; i < length / 2; i++) {
        const even = offset + i, odd = even + length / 2;
        const tr = wr * real[odd] - wi * imaginary[odd];
        const ti = wr * imaginary[odd] + wi * real[odd];
        real[odd] = real[even] - tr; imaginary[odd] = imaginary[even] - ti;
        real[even] += tr; imaginary[even] += ti;
        const nextR = wr * stepR - wi * stepI;
        wi = wr * stepI + wi * stepR; wr = nextR;
      }
    }
  }
  const magnitudes = new Float64Array(size / 2);
  let maximum = 0, energy = 0;
  for (let i = 1; i < magnitudes.length; i++) {
    magnitudes[i] = Math.hypot(real[i], imaginary[i]);
    maximum = Math.max(maximum, magnitudes[i]); energy += magnitudes[i] ** 2;
  }
  // Reject broadband noise rather than turning its random peaks into notes.
  if (maximum ** 2 / Math.max(energy, 1e-12) < 0.025) return { midi: [] as number[], rms };
  const peaks: { frequency: number; midi: number; strength: number }[] = [];
  for (let i = Math.max(2, Math.floor(26 * size / sampleRate)); i < magnitudes.length - 1; i++) {
    const strength = magnitudes[i];
    if (strength < maximum * 0.14 || strength <= magnitudes[i - 1] || strength <= magnitudes[i + 1]) continue;
    const a = Math.log(magnitudes[i - 1] + 1e-12), b = Math.log(strength + 1e-12), c = Math.log(magnitudes[i + 1] + 1e-12);
    const correction = Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / (a - 2 * b + c)));
    const frequency = (i + correction) * sampleRate / size;
    const pitch = 69 + 12 * Math.log2(frequency / 440), midi = Math.round(pitch);
    if (midi < 21 || midi > 108 || Math.abs(pitch - midi) > 0.4) continue;
    // A piano's overtones must not be scored as additional keys.
    if (peaks.some((peak) => {
      const ratio = frequency / peak.frequency, harmonic = Math.round(ratio);
      return harmonic >= 2 && harmonic <= 8 && Math.abs(1200 * Math.log2(ratio / harmonic)) < 35;
    })) continue;
    peaks.push({ frequency, midi, strength });
  }
  return { midi: peaks.sort((a, b) => b.strength - a.strength).slice(0, 6).map((p) => p.midi), rms };
}

export const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;

/** Two stable frames to accept a pitch; release before counting the same note again. */
export class PitchGate {
  private notes = new Map<number, { since: number; last: number; emitted: boolean; missing: boolean }>();
  update(midi: number[], now: number): number[] {
    const classes = new Set(midi.map(pitchClass));
    for (const [pitch, state] of this.notes) if (!classes.has(pitch)) {
      state.missing = true;
      if (now - state.last >= 180) this.notes.delete(pitch);
    }
    const attacks: number[] = [];
    for (const pitch of classes) {
      let state = this.notes.get(pitch);
      if (!state || (state.missing && now - state.last >= 180)) {
        state = { since: now, last: now, emitted: false, missing: false }; this.notes.set(pitch, state);
      }
      // A brief gap before stability starts the confidence check again.
      if (!state.emitted && now - state.last > 120) state.since = now;
      state.last = now; state.missing = false;
      if (!state.emitted && now - state.since >= 70) { state.emitted = true; attacks.push(pitch); }
    }
    return attacks;
  }
}
