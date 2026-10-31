import { detectPitches, PitchGate } from './pitchDetection';

interface MicrophoneCallbacks {
  onReady: () => void;
  onFrame: (midi: number[], level: number) => void;
  onNotes: (pitches: number[]) => void;
  onError: (message: string) => void;
  onStop: () => void;
}

export function startMicrophone(callbacks: MicrophoneCallbacks, minimumRms: number): () => void {
  let cancelled = false, stream: MediaStream | undefined, context: AudioContext | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(timer);
    source?.disconnect(); stream?.getTracks().forEach((track) => track.stop());
    void context?.close().catch(() => {});
    callbacks.onStop();
  };
  void (async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Abre la app mediante HTTPS (o localhost) para usar el micrófono.');
    const Audio = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) throw new Error('Este navegador no permite analizar audio. Prueba Safari o Chrome actualizados.');
    context = new Audio();
    await context.resume();
    if (cancelled) return;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1,
      echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
    const analyser = context.createAnalyser();
    analyser.fftSize = 16384;
    source = context.createMediaStreamSource(stream);
    source.connect(analyser); // Never connect the microphone to speakers.
    const samples = new Float32Array(analyser.fftSize), gate = new PitchGate();
    stream.getTracks().forEach((track) => track.addEventListener('ended', stop));
    context.addEventListener('statechange', () => { if (context?.state !== 'running') stop(); });
    callbacks.onReady();
    const frame = () => {
      if (cancelled) return;
      analyser.getFloatTimeDomainData(samples);
      const result = detectPitches(samples, context!.sampleRate, minimumRms);
      callbacks.onFrame(result.midi, result.rms);
      const attacks = gate.update(result.midi, performance.now());
      if (attacks.length) callbacks.onNotes(attacks);
      if (!cancelled) timer = setTimeout(frame, 80);
    };
    frame();
  })().catch((error: unknown) => {
    if (cancelled) return;
    stop();
    const name = error instanceof Error ? error.name : '';
    callbacks.onError(name === 'NotAllowedError' ? 'Permite el acceso al micrófono en los ajustes del navegador y vuelve a intentarlo.'
      : name === 'NotFoundError' ? 'No se encontró un micrófono conectado.'
      : name === 'NotReadableError' ? 'El micrófono está ocupado por otra aplicación.'
      : error instanceof Error ? error.message : 'No se pudo iniciar el micrófono.');
  });
  return stop;
}
