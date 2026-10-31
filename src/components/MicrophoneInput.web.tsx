import React, { useCallback, useRef, useState } from 'react';
import { AppState, Text, TouchableOpacity, View, Modal, ScrollView } from 'react-native';
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
  const [threshold, setThreshold] = useState(0.02);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const toggle = <TouchableOpacity accessibilityRole="button" accessibilityLabel={active ? 'Detener micrófono' : 'Activar micrófono'} onPress={active ? cancel : start}
    style={{ padding: props.compact ? 9 : 12, flex: props.compact ? 1 : undefined, borderRadius: 8, backgroundColor: active ? '#713746' : '#453058' }}>
    <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '700', fontSize: props.compact ? 12 : 14 }}>
      {active ? '⏹ Micrófono' : '🎤 Micrófono'}
    </Text>
  </TouchableOpacity>;
  const statusText = status === 'loading' ? 'Esperando permiso…' : frame.midi.length
    ? `Detectado: ${[...new Set(frame.midi.map((midi) => Note.pitchClass(Note.fromMidiSharps(midi))))].join(' + ')}`
    : 'Escuchando…';
  const settings = <>
    <Text style={{ color: '#BB86FC', fontWeight: '700' }}>🎤 Piano externo · cualquier octava</Text>
    <Text style={{ color: '#B0BEC5', fontSize: 12 }}>
      C1 = C2 = … = C8. Igual para las 12 notas; Do♯ sigue siendo distinto de Do. Puedes tocar las notas juntas o una por una.
    </Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {([{ label: 'Alta', value: 0.004 }, { label: 'Normal', value: 0.008 }, { label: 'Baja', value: 0.02 }]).map((choice) =>
        <TouchableOpacity key={choice.label} disabled={active} accessibilityRole="button"
          accessibilityLabel={`Sensibilidad ${choice.label}`} accessibilityState={{ selected: threshold === choice.value, disabled: active }}
          onPress={() => setThreshold(choice.value)} style={{ padding: 8, borderRadius: 8, backgroundColor: threshold === choice.value ? '#57416F' : '#252535' }}>
          <Text style={{ color: '#E0E0E0', fontSize: 12 }}>Sens. {choice.label}</Text>
        </TouchableOpacity>)}
    </View>
    <Text style={{ color: '#AAA', fontSize: 11 }}>
      El audio se analiza en este dispositivo; no se graba ni se envía. Deja un pequeño silencio al repetir la misma nota.
      Si un acorde no se reconoce completo, toca sus notas por separado. Evita conversaciones y música de fondo.
    </Text>
  </>;
  return <View style={props.compact ? { flex: 1, gap: 4 } : { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14, marginBottom: 12, gap: 8 }}>
    {props.compact ? <View style={{ flexDirection: 'row', gap: 4 }}>
      {toggle}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ajustes del micrófono" onPress={() => { cancel(); setSettingsOpen(true); }} style={{ padding: 9, backgroundColor: '#252535', borderRadius: 8 }}>
        <Text style={{ color: '#E0E0E0' }}>⚙</Text>
      </TouchableOpacity>
    </View> : <>{settings}{toggle}</>}
    {active && <>
      <Text numberOfLines={1} accessibilityLiveRegion="polite" style={{ color: '#03DAC6', fontSize: 11 }}>{statusText}</Text>
      <View style={{ height: 5, backgroundColor: '#333345', borderRadius: 3 }}>
        <View style={{ height: 5, width: `${Math.min(100, frame.level * 500)}%`, backgroundColor: '#03DAC6', borderRadius: 3 }} />
      </View>
    </>}
    {!!error && <TouchableOpacity onPress={() => setSettingsOpen(true)}><Text numberOfLines={1} accessibilityRole="alert" style={{ color: '#FF8A9D', fontSize: 11 }}>{error}</Text></TouchableOpacity>}
    <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#1A1A2E', padding: 18, borderRadius: 14, maxHeight: '85%' }}>
          <ScrollView contentContainerStyle={{ gap: 12 }}>{settings}
            {!!error && <Text style={{ color: '#FF8A9D' }}>{error}</Text>}
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" onPress={() => setSettingsOpen(false)} style={{ padding: 12 }}><Text style={{ color: '#03DAC6', textAlign: 'center' }}>Volver a la práctica</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}
