import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setAudioModeAsync } from 'expo-audio';
import { initAudioEngine } from '../services/audioEngine';

export default function RootLayout() {
  useEffect(() => {
    // Allow audio in silent mode (iOS)
    setAudioModeAsync({ playsInSilentMode: true });
    // Pre-init audio engine
    initAudioEngine();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0D0D14' },
          headerTintColor: '#BB86FC',
          headerTitleStyle: { fontWeight: '700', color: '#E0E0E0' },
          contentStyle: { backgroundColor: '#0D0D14' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: '🎹 Piano Trainer', headerLargeTitle: false }}
        />
        <Stack.Screen
          name="practice"
          options={{ title: 'Práctica', headerBackTitle: 'Inicio' }}
        />
        <Stack.Screen
          name="analysis"
          options={{ title: 'Análisis del Fragmento', headerBackTitle: 'Práctica' }}
        />
      </Stack>
    </>
  );
}
