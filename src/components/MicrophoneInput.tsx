import React from 'react';
import { Text, View } from 'react-native';

export interface MicrophoneInputProps {
  onNotes: (pitches: number[]) => void;
  onActiveChange: (active: boolean) => void;
}

export default function MicrophoneInput(_props: MicrophoneInputProps) {
  return <View style={{ padding: 12 }}><Text style={{ color: '#B0BEC5', fontSize: 13 }}>
    🎤 Piano externo: abre la versión web en Safari o Chrome para usar el micrófono.
    La detección en tiempo real no está disponible en Expo Go.
  </Text></View>;
}
