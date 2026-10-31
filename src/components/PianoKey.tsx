import React from 'react';
import { View, type ViewProps } from 'react-native';

export interface PianoKeyProps extends Pick<ViewProps, 'style' | 'children'> {
  note: string;
  onDown: (note: string) => void;
  onUp: (note: string) => void;
  onPress: (note: string) => void;
}

export default function PianoKey({ note, onDown, onUp, onPress, ...props }: PianoKeyProps) {
  return <View {...props} accessible accessibilityRole="button" accessibilityLabel={note}
    onTouchStart={() => onDown(note)} onTouchEnd={() => onUp(note)} onTouchCancel={() => onUp(note)}
    onAccessibilityTap={() => onPress(note)} />;
}
