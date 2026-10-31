import React from 'react';
import { Text, View } from 'react-native';

export interface MicrophoneInputProps {
  compact?: boolean;
  onNotes: (pitches: number[]) => void;
  onActiveChange: (active: boolean) => void;
}

export default function MicrophoneInput({ compact }: MicrophoneInputProps) {
  return <View style={{ padding: compact ? 6 : 12, flex: compact ? 1 : undefined }}><Text style={{ color: '#B0BEC5', fontSize: compact ? 11 : 13 }}>
    🎤 Piano externo: abre la versión web en Safari o Chrome para usar el micrófono.
    La detección en tiempo real no está disponible en Expo Go.
  </Text></View>;
}
