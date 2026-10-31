import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import PianoKey from './PianoKey';

interface KeyDef {
  note: string;
  isBlack: boolean;
  label: string;
}

interface PianoKeyboardProps {
  onNotePress: (note: string) => void;
  correctNote?: string | null;
  pressedNote?: string | null;
  correctNotes?: string[];
  pressedNotes?: string[];
  rangeNotes?: string[];
  onNoteDown?: (note: string) => void;
  onNoteUp?: (note: string) => void;
}

function extractOctave(note: string | null | undefined): number | null {
  if (!note) return null;
  const match = note.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export default function PianoKeyboard({
  onNotePress,
  correctNote,
  pressedNote,
  correctNotes = [],
  pressedNotes = [],
  rangeNotes = [],
  onNoteDown,
  onNoteUp,
}: PianoKeyboardProps) {
  const [startOctave, setStartOctave] = useState<number>(4);
  const [previousRange, setPreviousRange] = useState('');
  const targetOctaves = (rangeNotes.length ? rangeNotes : [correctNote]).map(extractOctave).filter((octave): octave is number => octave !== null);
  const lowestOctave = targetOctaves.length ? Math.min(...targetOctaves) : startOctave;
  const highestOctave = targetOctaves.length ? Math.max(...targetOctaves) : startOctave;
  const rangeKey = (rangeNotes.length ? rangeNotes : [correctNote ?? '']).join(',');

  // Auto-shift keyboard when note target moves outside visible window
  if (previousRange !== rangeKey) {
    setPreviousRange(rangeKey);
    if (lowestOctave < startOctave || highestOctave > startOctave + 1) {
      setStartOctave(Math.max(0, Math.min(7, lowestOctave, highestOctave - 1)));
    }
  }

  const screenWidth = Dimensions.get('window').width;
  const keyboardWidth = Math.min(screenWidth - 24, 460);

  const octaveCount = Math.max(2, highestOctave - lowestOctave + 1);
  const octaves = Array.from({ length: octaveCount }, (_, index) => startOctave + index);
  const down = (note: string) => (onNoteDown ?? onNotePress)(note);
  const up = (note: string) => onNoteUp?.(note);
  const isPressed = (note: string) => pressedNote === note || pressedNotes.includes(note);
  const isTarget = (note: string) => correctNote === note || correctNotes.includes(note);

  const whiteKeys: KeyDef[] = [];
  const blackKeys: { note: string; offset: number; label: string }[] = [];

  let whiteIndex = 0;
  octaves.forEach((oct) => {
    const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const blackOffsets: Record<string, number> = {
      'C#': 0.65,
      'D#': 1.65,
      'F#': 3.65,
      'G#': 4.65,
      'A#': 5.65,
    };

    letters.forEach((l) => {
      whiteKeys.push({ note: `${l}${oct}`, isBlack: false, label: l });
    });

    Object.entries(blackOffsets).forEach(([sharp, off]) => {
      blackKeys.push({
        note: `${sharp}${oct}`,
        offset: whiteIndex + off,
        label: sharp,
      });
    });

    whiteIndex += 7;
  });

  const whiteKeyWidth = keyboardWidth / whiteKeys.length;
  const whiteKeyHeight = 180;
  const blackKeyWidth = whiteKeyWidth * 0.62;
  const blackKeyHeight = 108;

  const getWhiteKeyColor = (note: string) => {
    if (isPressed(note)) return '#BB86FC';
    if (isTarget(note)) return '#03DAC6';
    return '#F5F5F5';
  };

  const getBlackKeyColor = (note: string) => {
    if (isPressed(note)) return '#9B59B6';
    if (isTarget(note)) return '#00BFA5';
    return '#1A1A1A';
  };

  const canShiftDown = startOctave > 0;
  const canShiftUp = startOctave < 7;

  return (
    <View style={styles.container}>
      {/* Octave shift controls - Designed to fit 100% within mobile width */}
      <View style={[styles.octaveHeader, { width: keyboardWidth }]}>
        <TouchableOpacity
          style={[styles.octaveBtn, !canShiftDown && styles.octaveBtnDisabled]}
          onPress={() => setStartOctave((o) => Math.max(0, o - 1))}
          disabled={!canShiftDown}
          activeOpacity={0.7}
        >
          <Text style={styles.octaveBtnText}>◀ Oct -</Text>
        </TouchableOpacity>

        <View style={styles.octaveBadge}>
          <Text style={styles.octaveBadgeText}>
            C{startOctave} – B{startOctave + octaveCount - 1}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.octaveBtn, !canShiftUp && styles.octaveBtnDisabled]}
          onPress={() => setStartOctave((o) => Math.min(7, o + 1))}
          disabled={!canShiftUp}
          activeOpacity={0.7}
        >
          <Text style={styles.octaveBtnText}>Oct + ▶</Text>
        </TouchableOpacity>
      </View>

      {/* Keyboard view */}
      <View style={[styles.wrapper, { height: whiteKeyHeight + 4 }]}>
        {/* White keys */}
        <View style={[styles.whiteKeysRow, { width: keyboardWidth }]}>
          {whiteKeys.map((key) => (
            <PianoKey
              key={key.note}
              note={key.note} onDown={down} onUp={up} onPress={onNotePress}
              style={[
                styles.whiteKey,
                {
                  width: whiteKeyWidth - 2,
                  height: whiteKeyHeight,
                  backgroundColor: getWhiteKeyColor(key.note),
                  borderColor:
                    isTarget(key.note)
                      ? '#03DAC6'
                      : isPressed(key.note)
                      ? '#BB86FC'
                      : '#9E9E9E',
                  borderWidth:
                    isTarget(key.note) || isPressed(key.note) ? 2 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.whiteKeyLabel,
                  {
                    color:
                      isPressed(key.note)
                        ? '#9B59B6'
                        : isTarget(key.note)
                        ? '#00897B'
                        : '#555',
                  },
                ]}
              >
                {key.label}
                <Text style={styles.subOctave}>{key.note.slice(1)}</Text>
              </Text>
            </PianoKey>
          ))}
        </View>

        {/* Black keys */}
        <View
          style={[styles.blackKeysOverlay, { width: keyboardWidth, height: blackKeyHeight }]}
          pointerEvents="box-none"
        >
          {blackKeys.map((key) => {
            const leftPos = key.offset * whiteKeyWidth;
            return (
              <PianoKey
                key={key.note}
                note={key.note} onDown={down} onUp={up} onPress={onNotePress}
                style={[
                  styles.blackKey,
                  {
                    left: leftPos,
                    width: blackKeyWidth,
                    height: blackKeyHeight,
                    backgroundColor: getBlackKeyColor(key.note),
                  },
                ]}
              >
                <Text style={styles.blackKeyLabel}>{key.label}</Text>
              </PianoKey>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  octaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  octaveBtn: {
    backgroundColor: '#252538',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3D3D54',
  },
  octaveBtnDisabled: {
    opacity: 0.25,
  },
  octaveBtnText: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: '800',
  },
  octaveBadge: {
    backgroundColor: '#1E1E2E',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2F2F44',
  },
  octaveBadgeText: {
    color: '#03DAC6',
    fontSize: 12,
    fontWeight: '700',
  },
  wrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  whiteKeysRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  whiteKey: {
    borderRadius: 5,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 6,
    marginRight: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  whiteKeyLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  subOctave: {
    fontSize: 9,
    fontWeight: 'normal',
    color: '#888',
  },
  blackKeysOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 68,
  },
  blackKey: {
    position: 'absolute',
    borderRadius: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 4,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#333',
  },
  blackKeyLabel: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
});
