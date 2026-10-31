import React, { useCallback, useRef, useState } from 'react';
import { AppState, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Note } from '@tonaljs/tonal';
import { startMicrophone } from '../services/microphoneCapture.web';
import { stopAll } from '../services/audioEngine';
import type { MicrophoneInputProps } from './MicrophoneInput';

export default function MicrophoneInput(props: MicrophoneInputProps) {
  const stopRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'listening'>('idle');
  const [frame, setFrame] = useState({ midi: [] as number[], level: 0 });
  const [error, setError] = useState('');
  const [threshold, setThreshold] = useState(0.008);
  const cancel = useCallback(() => { stopRef.current?.(); stopRef.current = null; }, []);
  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { subscription.remove(); document.removeEventListener('visibilitychange', hidden); cancel(); };
  }, [cancel]));
  const start = () => {
    cancel(); stopAll(); setError(''); setStatus('loading');
    props.onActiveChange(true);
    stopRef.current = startMicrophone({
      onReady: () => setStatus('listening'),
      onFrame: (midi, level) => setFrame({ midi, level }),
      onNotes: props.onNotes,
      onStop: () => { setStatus('idle'); setFrame({ midi: [], level: 0 }); props.onActiveChange(false); },
      onError: setError,
    }, threshold);
  };
  const active = status !== 'idle';
  return <View style={{ backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14, marginBottom: 12, gap: 8 }}>
    <Text style={{ color: '#BB86FC', fontWeight: '700' }}>🎤 Piano externo · cualquier octava</Text>
    <Text style={{ color: '#B0BEC5', fontSize: 12 }}>
      Do2 = Do3 = Do4. Se mantienen sostenidos y bemoles. Puedes tocar las notas juntas o una por una.
    </Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {([{ label: 'Alta', value: 0.004 }, { label: 'Normal', value: 0.008 }, { label: 'Baja', value: 0.02 }]).map((choice) =>
        <TouchableOpacity key={choice.label} disabled={active} accessibilityRole="button"
          accessibilityLabel={`Sensibilidad ${choice.label}`} accessibilityState={{ selected: threshold === choice.value, disabled: active }}
          onPress={() => setThreshold(choice.value)} style={{ padding: 8, borderRadius: 8, backgroundColor: threshold === choice.value ? '#57416F' : '#252535' }}>
          <Text style={{ color: '#E0E0E0', fontSize: 12 }}>Sens. {choice.label}</Text>
        </TouchableOpacity>)}
    </View>
    <TouchableOpacity accessibilityRole="button" onPress={active ? cancel : start}
      style={{ padding: 12, borderRadius: 8, backgroundColor: active ? '#713746' : '#453058' }}>
      <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '700' }}>
        {active ? '⏹ Detener micrófono' : '🎤 Activar micrófono'}
      </Text>
    </TouchableOpacity>
    {active && <>
      <Text accessibilityLiveRegion="polite" style={{ color: '#03DAC6' }}>
        {status === 'loading' ? 'Esperando permiso del micrófono…' : frame.midi.length
          ? `Detectado: ${[...new Set(frame.midi.map((midi) => Note.pitchClass(Note.fromMidiSharps(midi))))].join(' + ')}`
          : 'Escuchando… toca una nota en tu piano.'}
      </Text>
      <View style={{ height: 5, backgroundColor: '#333345', borderRadius: 3 }}>
        <View style={{ height: 5, width: `${Math.min(100, frame.level * 500)}%`, backgroundColor: '#03DAC6', borderRadius: 3 }} />
      </View>
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#FF8A9D' }}>{error}</Text>}
    <Text style={{ color: '#AAA', fontSize: 11 }}>
      El audio se analiza en este dispositivo; no se graba ni se envía. Deja un pequeño silencio al repetir la misma nota.
      Si un acorde no se reconoce completo, toca sus notas por separado. Evita conversaciones y música de fondo.
    </Text>
  </View>;
}
