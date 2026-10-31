import React, { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { MidiNote } from '../store/practiceStore';
import { playbackFrame } from '../services/playbackTimeline';

// ─── Music theory constants ────────────────────────────────────────────────

const STEP = 7;

function getDiatonicStep(noteName: string): number {
  const match = noteName.match(/^([A-G])[#b]?(\d+)$/);
  if (!match) return 4 * 7;
  const [, letter, octStr] = match;
  const oct = parseInt(octStr, 10);
  const letterMap: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  return oct * 7 + (letterMap[letter] ?? 0);
}

function getNoteRawY(noteName: string, clef: 'treble' | 'bass'): number {
  const noteStep = getDiatonicStep(noteName);
  const topRefStep = clef === 'treble' ? (5 * 7 + 3) : (3 * 7 + 5);
  // Unadjusted Y relative to staff top line = 0
  return (topRefStep - noteStep) * STEP;
}

interface StaffProps {
  notes: MidiNote[];
  currentNoteIndex: number;
  currentNoteIndices?: number[];
  clef: 'treble' | 'bass';
  width?: number;
  maxHeight?: number;
  showNoteNames?: boolean;
  playbackTime?: number;
  playbackActive?: boolean;
}

export default function Staff({
  notes,
  currentNoteIndex,
  currentNoteIndices,
  clef,
  width = 340,
  maxHeight,
  showNoteNames = true,
  playbackTime,
  playbackActive = true,
}: StaffProps) {
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const paddingLeft = 56;
  const paddingRight = 56;
  const baseSpacing = 46;

  // Calculate dynamic vertical bounds so notes never exceed the canvas
  const { staffTopY, svgHeight, rawYs } = useMemo(() => {
    if (notes.length === 0) {
      return { staffTopY: 80, svgHeight: 200, rawYs: [] };
    }

    const computedRaw = notes.map((n) => getNoteRawY(n.name, clef));
    const minRaw = Math.min(...computedRaw); // Highest pitch (lowest Y)
    const maxRaw = Math.max(...computedRaw); // Lowest pitch (highest Y)

    // Baseline 5 staff lines span from 0 to STEP * 8
    // We add margin above minRaw and below maxRaw
    const margin = 34;
    const topExtent = Math.min(0, minRaw) - margin;
    const bottomExtent = Math.max(STEP * 8, maxRaw) + margin;

    const staffTop = -topExtent;
    const totalH = Math.max(maxHeight ? 110 : 200, bottomExtent - topExtent);

    return { staffTopY: staffTop, svgHeight: totalH, rawYs: computedRaw };
  }, [notes, clef, maxHeight]);

  const staffLinesY = [
    staffTopY,
    staffTopY + STEP * 2,
    staffTopY + STEP * 4,
    staffTopY + STEP * 6,
    staffTopY + STEP * 8,
  ];

  const getLedgersY = React.useCallback((noteY: number): number[] => {
    const topStaff = staffTopY;
    const bottomStaff = staffTopY + STEP * 8;
    const ledgers: number[] = [];

    // Above staff
    if (noteY <= topStaff - STEP) {
      for (let y = topStaff - STEP * 2; y >= noteY - 1; y -= STEP * 2) {
        ledgers.push(y);
      }
    }
    // Below staff
    if (noteY >= bottomStaff + STEP) {
      for (let y = bottomStaff + STEP * 2; y <= noteY + 1; y += STEP * 2) {
        ledgers.push(y);
      }
    }
    return ledgers;
  }, [staffTopY]);

  /**
   * Group simultaneous notes and compute layout coordinates
   */
  const positionedNotes = useMemo(() => {
    let currentX = paddingLeft;
    const positions: {
      note: MidiNote;
      x: number;
      y: number;
      isSharp: boolean;
      isFlat: boolean;
      ledgerLines: number[];
    }[] = [];

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const prev = notes[i - 1];

      // Detect simultaneous notes (< 50ms)
      const isSimultaneous = prev && Math.abs(note.time - prev.time) < 0.05;

      if (!isSimultaneous && i > 0) {
        currentX += baseSpacing;
      }

      const y = staffTopY + (rawYs[i] ?? 0);

      // Offset simultaneous close-interval note heads
      let xOffset = 0;
      if (isSimultaneous) {
        const prevPos = positions[i - 1];
        if (prevPos && Math.abs(prevPos.y - y) <= STEP * 1.5) {
          xOffset = 13;
        }
      }

      const noteX = currentX + xOffset;
      const isSharp = note.name.includes('#');
      const isFlat = note.name.includes('b');
      const ledgerLines = getLedgersY(y);

      positions.push({
        note,
        x: noteX,
        y,
        isSharp,
        isFlat,
        ledgerLines,
      });
    }

    return positions;
  }, [notes, staffTopY, rawYs, getLedgersY]);

  const lastNoteX = positionedNotes.length > 0 ? positionedNotes[positionedNotes.length - 1].x : 0;
  const calculatedWidth = Math.max(width, lastNoteX + paddingRight);

  const frame = playbackTime === undefined ? null : playbackFrame(notes, playbackTime);
  const followIndex = frame ? Math.max(0, frame.lastStartedIndex) : currentNoteIndex;
  let cursorX = positionedNotes[followIndex]?.x ?? paddingLeft;
  if (playbackTime !== undefined && followIndex >= 0) {
    const current = positionedNotes[followIndex];
    const next = positionedNotes.slice(followIndex + 1).find((p) => p.note.time > (current?.note.time ?? 0));
    if (current && next) {
      const fraction = Math.max(0, Math.min(1, (playbackTime - current.note.time) / (next.note.time - current.note.time)));
      cursorX += (next.x - current.x) * fraction;
    }
  }

  // Playback follows the clock smoothly; manual practice follows the target note.
  useEffect(() => {
    if (followIndex >= 0 && scrollViewRef.current) {
      const targetScroll = Math.max(0, Math.min(calculatedWidth - width, cursorX - width * 0.35));
      scrollViewRef.current.scrollTo({ x: targetScroll, animated: playbackTime === undefined });
    }
  }, [followIndex, cursorX, calculatedWidth, width, playbackTime]);

  const clefSymbol = clef === 'treble' ? '𝄞' : '𝄢';
  const clefY = clef === 'treble' ? staffTopY + STEP * 6.5 : staffTopY + STEP * 4.5;
  const clefFontSize = clef === 'treble' ? 54 : 44;

  const playbackMode = frame !== null;
  const highlightKey = frame ? (playbackActive ? frame.activeIndices.join(',') : '') : currentNoteIndices?.join(',') ?? String(currentNoteIndex);
  const highlightIndices = useMemo(() => new Set(highlightKey === '' ? [] : highlightKey.split(',').map(Number)), [highlightKey]);
  const playedIndex = frame?.lastStartedIndex ?? -1;
  // Reuse the SVG note tree between attacks while only the playback cursor moves.
  const renderedNotes = useMemo(() => positionedNotes.map(({ note, x, y, isSharp, isFlat, ledgerLines }, i) => {
            const isCurrent = highlightIndices.has(i);
            const hasPlayed = playbackMode && i <= playedIndex && !isCurrent;
            const fillColor = isCurrent ? '#03DAC6' : hasPlayed ? '#BB86FC' : '#FFFFFF';
            const strokeColor = isCurrent ? '#00BFA5' : '#D0D0E0';
            const textColor = isCurrent ? '#03DAC6' : '#BB86FC';

            return (
              <G key={`note-${i}`}>
                {/* Ledger lines */}
                {ledgerLines.map((ly) => (
                  <Line
                    key={`ledger-${i}-${ly}`}
                    x1={x - 12}
                    y1={ly}
                    x2={x + 12}
                    y2={ly}
                    stroke="#828298"
                    strokeWidth={1.5}
                  />
                ))}

                {/* Accidental */}
                {isSharp && (
                  <SvgText
                    x={x - 11}
                    y={y + 5}
                    fontSize={13}
                    fill="#D1A3FF"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ♯
                  </SvgText>
                )}
                {isFlat && (
                  <SvgText
                    x={x - 11}
                    y={y + 5}
                    fontSize={13}
                    fill="#D1A3FF"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ♭
                  </SvgText>
                )}

                {/* Note head */}
                <Circle
                  cx={x}
                  cy={y}
                  r={5.5}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isCurrent ? 2.5 : 1}
                />

                {/* Note stem */}
                {y > staffTopY + STEP * 4 ? (
                  <Line
                    x1={x + 5}
                    y1={y}
                    x2={x + 5}
                    y2={y - STEP * 3.5}
                    stroke={fillColor}
                    strokeWidth={1.8}
                  />
                ) : (
                  <Line
                    x1={x - 5}
                    y1={y}
                    x2={x - 5}
                    y2={y + STEP * 3.5}
                    stroke={fillColor}
                    strokeWidth={1.8}
                  />
                )}

                {/* Note name */}
                {showNoteNames && (
                  <SvgText
                    x={x}
                    y={y + (y > staffTopY + STEP * 4 ? 17 : -13)}
                    fontSize={11}
                    fill={textColor}
                    fontWeight={isCurrent ? 'bold' : '600'}
                    textAnchor="middle"
                  >
                    {note.name}
                  </SvgText>
                )}

                {/* Current note indicator */}
                {isCurrent && (
                  <SvgText
                    x={x}
                    y={staffTopY - 12}
                    fontSize={16}
                    fill="#03DAC6"
                    textAnchor="middle"
                  >
                    ▼
                  </SvgText>
                )}
              </G>
            );
          }), [positionedNotes, highlightIndices, playbackMode, playedIndex, showNoteNames, staffTopY]);

  const displayHeight = maxHeight ? Math.min(svgHeight, maxHeight) : svgHeight;
  return (
    <View style={[styles.container, { width }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={{ minWidth: width }}
        style={{ width, height: displayHeight, flexGrow: 0 }}
      >
        <Svg width={calculatedWidth} height={displayHeight} viewBox={`0 0 ${calculatedWidth} ${svgHeight}`} preserveAspectRatio="none">
          {/* 5 Staff lines */}
          {staffLinesY.map((y, i) => (
            <Line
              key={`staff-${i}`}
              x1={10}
              y1={y}
              x2={calculatedWidth - 10}
              y2={y}
              stroke="#828298"
              strokeWidth={1.5}
            />
          ))}

          {/* Clef sign */}
          <SvgText
            x={22}
            y={clefY}
            fontSize={clefFontSize}
            fill="#BB86FC"
            fontFamily="serif"
            textAnchor="middle"
          >
            {clefSymbol}
          </SvgText>

          {/* Notes */}
          {playbackTime !== undefined && <Line x1={cursorX} x2={cursorX}
            y1={staffTopY - 20} y2={staffTopY + STEP * 8 + 20} stroke="#03DAC6" strokeWidth={2} />}
          {renderedNotes}
        </Svg>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E2E',
    borderRadius: 14,
    paddingVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2E2E3E',
  },
});
