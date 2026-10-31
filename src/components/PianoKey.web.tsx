import React from 'react';
import { View } from 'react-native';
import type { PianoKeyProps } from './PianoKey';

export default function PianoKey({ note, onDown, onUp, onPress, style, children }: PianoKeyProps) {
  return <View style={style}>
    <View pointerEvents="none">{children}</View>
    <button type="button" aria-label={note}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
        background: 'transparent', border: 0, borderRadius: 'inherit', cursor: 'pointer',
        touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        onDown(note);
      }}
      onPointerUp={() => onUp(note)} onPointerCancel={() => onUp(note)}
      onLostPointerCapture={() => onUp(note)}
      onClick={(event) => { if (event.detail === 0) onPress(note); }} />
  </View>;
}
