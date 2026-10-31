import React from 'react';
import { View, type ViewProps } from 'react-native';

export interface PianoKeyProps extends Pick<ViewProps, 'style' | 'children'> {
  disabled?: boolean;
  note: string;
  onDown: (note: string) => void;
  onUp: (note: string) => void;
  onPress: (note: string) => void;
}

export default function PianoKey({ note, onDown, onUp, onPress, disabled, ...props }: PianoKeyProps) {
  return <View {...props} accessible accessibilityRole="button" accessibilityLabel={note}
    accessibilityState={{ disabled }}
    onTouchStart={() => { if (!disabled) onDown(note); }} onTouchEnd={() => { if (!disabled) onUp(note); }} onTouchCancel={() => { if (!disabled) onUp(note); }}
    onAccessibilityTap={() => { if (!disabled) onPress(note); }} />;
}
