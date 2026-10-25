import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { Note } from '@tonaljs/tonal';
import { PIANO_SAMPLES } from './pianoSamples';
import { startPlaybackTimeline } from './playbackTimeline';
import type { PlaybackPlan } from './playbackTimeline';

// ─── Web Audio Engine (Tone.js with Synth Fallback) ────────────────────────

class WebAudioEngine {
  private generation = 0;
  private sampler: any = null;
  private synth: any = null;
  private Tone: any = null;
  private loaded = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.Tone = await import('tone');

        // PolySynth ensures instantaneous, accurate pitch synthesis in any scale
        // while the external sample library buffers.
        this.synth = new this.Tone.PolySynth(this.Tone.Synth, {
          oscillator: { type: 'triangle8' },
          envelope: {
            attack: 0.005,
            decay: 1.5,
            sustain: 0.2,
            release: 1.2,
          },
        }).toDestination();
        this.synth.volume.value = -4;

        const urls: Record<string, string> = Object.fromEntries(
          Object.entries(PIANO_SAMPLES).map(([midi, sample]) => [
            Note.fromMidi(Number(midi)), Asset.fromModule(sample).uri,
          ]),
        );
        this.sampler = new this.Tone.Sampler({
          urls,
          onload: () => {
            this.loaded = true;
          },
        }).toDestination();
        this.sampler.volume.value = 0;
      } catch (e) {
        console.warn('[WebAudio] Initialization error:', e);
      }
    })();

    return this.initPromise;
  }

  async preparePlayback() {
    if (!this.Tone) await this.init();
    if (this.Tone && this.Tone.context.state !== 'running') {
      try {
        await this.Tone.start();
      } catch (_) {}
    }
  }

  async playNote(note: string, duration?: number) {
    const generation = this.generation;
    await this.preparePlayback();
    if (generation !== this.generation) return;
    try {
      if (this.loaded && this.sampler) {
        this.sampler.triggerAttackRelease(note, duration ?? '2n');
      } else if (this.synth) {
        this.synth.triggerAttackRelease(note, duration ?? '2n');
      }
    } catch (e) {
      console.warn('[WebAudio] playNote error:', e);
    }
  }

  async playSequence(notes: { name: string; time: number; duration?: number }[], _tempo: number) {
    await this.preparePlayback();
    try {
      const now = this.Tone ? this.Tone.now() : 0;
      const instrument = (this.loaded && this.sampler) ? this.sampler : this.synth;
      if (!instrument) return;

      notes.forEach((note) => {
        instrument.triggerAttackRelease(note.name, note.duration ?? '8n', now + note.time);
      });
    } catch (e) {
      console.warn('[WebAudio] playSequence error:', e);
    }
  }

  stopAll() {
    this.generation++;
    try {
      this.sampler?.releaseAll?.();
      this.synth?.releaseAll?.();
    } catch (_) {}
  }
}

// ─── Native Audio Engine (expo-audio with bundled samples) ────────────────────

class NativeAudioEngine {
  private activePlayers: any[] = [];
  private generation = 0;
  private audioModule: typeof import('expo-audio') | null = null;

  async preparePlayback() {
    this.audioModule ??= await import('expo-audio');
  }

  async playNote(note: string, duration?: number) {
    const generation = this.generation;
    const midi = Note.midi(note);
    const sample = midi === null ? undefined : PIANO_SAMPLES[midi];
    if (sample === undefined) return;
    try {
      await this.preparePlayback();
      if (generation !== this.generation) return;
      const { createAudioPlayer } = this.audioModule!;
      const player = createAudioPlayer(sample);
      this.activePlayers.push(player);
      player.play();

      setTimeout(() => {
        try {
          player.remove();
          this.activePlayers = this.activePlayers.filter((p) => p !== player);
        } catch (_) {}
      }, duration === undefined ? 4000 : (duration + 0.12) * 1000);
    } catch (e) {
      console.warn('[NativeAudio] playNote error:', e);
    }
  }

  async playSequence(notes: { name: string; time: number }[], _tempo: number) {
    notes.forEach((note) => {
      setTimeout(() => this.playNote(note.name), note.time * 1000);
    });
  }

  stopAll() {
    this.generation++;
    this.activePlayers.forEach((player) => {
      try {
        player.pause?.();
        player.remove?.();
      } catch (_) {}
    });
    this.activePlayers = [];
  }
}

// ─── Unified Interface ───────────────────────────────────────────────────

let engine: WebAudioEngine | NativeAudioEngine | null = null;
let engineInitialization: Promise<void> | null = null;
let stopTrackedPlayback: (() => void) | null = null;

export async function initAudioEngine() {
  if (engine) return;

  engineInitialization ??= (async () => {
    if (Platform.OS === 'web') {
      const web = new WebAudioEngine();
      await web.init();
      engine = web;
    } else {
      engine = new NativeAudioEngine();
    }
  })();
  await engineInitialization;
}

export async function playNote(note: string) {
  if (!engine) await initAudioEngine();
  await engine!.playNote(note);
}

export async function playSequence(
  notes: { name: string; time: number; duration?: number }[],
  tempo: number,
) {
  if (!engine) await initAudioEngine();
  await engine!.playSequence(notes, tempo);
}

export function stopAll() {
  stopTrackedPlayback?.();
  stopTrackedPlayback = null;
  engine?.stopAll();
}

export function startTrackedPlayback(plan: PlaybackPlan, callbacks: {
  onProgress: (seconds: number) => void;
  onComplete: () => void;
  onError: (error: unknown) => void;
}): () => void {
  stopAll();
  let cancelled = false;
  let stopTimeline: (() => void) | undefined;
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    stopTimeline?.();
    engine?.stopAll();
    if (stopTrackedPlayback === stop) stopTrackedPlayback = null;
  };
  stopTrackedPlayback = stop;
  void (async () => {
    await initAudioEngine();
    await engine!.preparePlayback();
    if (cancelled) return;
    stopTimeline = startPlaybackTimeline(plan, {
      onNote: (note) => { void engine!.playNote(note.name, note.duration).catch(callbacks.onError); },
      onProgress: callbacks.onProgress,
      onComplete: () => { stop(); callbacks.onComplete(); },
    });
  })().catch((error) => { if (!cancelled) { stop(); callbacks.onError(error); } });
  return stop;
}
