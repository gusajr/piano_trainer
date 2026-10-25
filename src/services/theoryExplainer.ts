import { Chord, Interval, Note, Scale } from '@tonaljs/tonal';

export interface TheoryTopic {
  kind: 'chord' | 'arpeggio' | 'scale' | 'interval' | 'note';
  value: string;
  harmonic?: boolean;
}
export interface TheoryExplanation { title: string; paragraphs: string[] }

export function chordFromSymbol(symbol: string) {
  // This Tonal version does not parse slash-bass symbols through Chord.get.
  return Chord.get(symbol.replace(/\/[A-G][#b]*$/, ''));
}

const INTERVALS = ['unísono', 'segunda menor', 'segunda mayor', 'tercera menor', 'tercera mayor',
  'cuarta justa', 'tritono', 'quinta justa', 'sexta menor', 'sexta mayor', 'séptima menor', 'séptima mayor'];

export function intervalName(semitones: number): string {
  const distance = Math.abs(semitones);
  if (!distance) return 'Unísono';
  const octaves = Math.floor(distance / 12);
  const remainder = distance % 12;
  const base = octaves ? `${octaves === 1 ? 'Octava' : `${octaves} octavas`}${remainder ? ` + ${INTERVALS[remainder]}` : ''}` : INTERVALS[remainder];
  return `${base.charAt(0).toUpperCase()}${base.slice(1)} ${semitones < 0 ? 'descendente' : 'ascendente'}`;
}

export function spanishNote(value: string): string {
  const note = Note.get(value);
  if (note.empty) return value;
  const names: Record<string, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  return `${names[note.letter]}${note.acc.replace(/#/g, '♯').replace(/b/g, '♭')}${note.oct ?? ''}`;
}

export function scaleIdentifier(value: string): string {
  return value.replace('menor armónica', 'harmonic minor').replace('menor melódica', 'melodic minor')
    .replace('menor natural', 'minor').replace('menor', 'minor').replace('mayor', 'major');
}

export function explainTheory(topic: TheoryTopic): TheoryExplanation {
  const { kind, value } = topic;
  if (kind === 'note') return { title: `${value} · ${spanishNote(value)}`, paragraphs: [
    'Las letras C, D, E, F, G, A y B equivalen a Do, Re, Mi, Fa, Sol, La y Si.',
    '♯ (sostenido) sube un semitono; ♭ (bemol) baja un semitono. El número indica la octava: C4 es el Do central.',
  ] };
  if (kind === 'interval') {
    const interval = Interval.get(value);
    if (interval.empty || interval.semitones === undefined) return { title: value, paragraphs: ['Un intervalo es la distancia entre dos notas. Puede ser melódico (sucesivas) o armónico (simultáneas).'] };
    const semitones = interval.semitones;
    return { title: topic.harmonic ? intervalName(semitones).replace(/ (ascendente|descendente)$/, '') : intervalName(semitones), paragraphs: [
      `Distancia: ${Math.abs(semitones)} semitonos (${Math.abs(semitones) / 2} tonos). Un semitono es la distancia entre teclas contiguas del piano, incluyendo las negras.`,
      `Ejemplo desde C4 (Do central): C4 → ${Note.transpose('C4', value)}. Cifra del intervalo: ${value}.`,
      'Melódico: las notas se tocan una después de otra. Armónico: suenan a la vez. La dirección ascendente o descendente se aplica al movimiento melódico.',
    ] };
  }
  if (kind === 'scale') {
    const scale = Scale.get(scaleIdentifier(value));
    return { title: `Escala: ${value}`, paragraphs: scale.empty ? [
      'Una escala organiza notas alrededor de una tónica. La estimación automática propone una escala compatible con las notas analizadas; una frase breve puede encajar en varias escalas.',
    ] : [
      `Notas: ${scale.notes.map((n) => `${n} (${spanishNote(n)})`).join(' · ')}.`,
      `Se forma desde ${scale.tonic} con los intervalos ${scale.intervals.join(' · ')} respecto a la tónica. Distancias: ${scale.intervals.map((i) => Interval.semitones(i)).join(' · ')} semitonos.`,
      'La tónica es el centro de reposo. Las notas de paso y las alteraciones pueden estar fuera de esta escala; por eso el análisis es una estimación.',
    ] };
  }
  const chord = chordFromSymbol(value);
  if (chord.empty) return { title: value, paragraphs: ['No hay un acorde completo identificable para este conjunto de notas. Un acorde necesita una combinación de alturas; una nota o un intervalo por sí solos no determinan su calidad.'] };
  const formula = chord.intervals.map((i) => {
    const interval = Interval.get(i);
    const alteration = interval.alt ?? 0;
    return `${alteration < 0 ? '♭'.repeat(-alteration) : alteration > 0 ? '♯'.repeat(alteration) : ''}${interval.num}`;
  }).join('–');
  return { title: `${kind === 'arpeggio' ? 'Arpegio de ' : 'Acorde '}${value}`, paragraphs: [
    `Fundamental: ${chord.tonic} (${spanishNote(chord.tonic ?? '')}). Notas: ${chord.notes.map((n) => `${n} (${spanishNote(n)})`).join(' · ')}.`,
    `Fórmula: ${formula}. Se forma tomando estos grados desde la fundamental: ${chord.intervals.join(' · ')}. Distancias: ${chord.intervals.map((i) => Interval.semitones(i)).join(' · ')} semitonos.`,
    value.includes('maj7') || value.includes('M7') ? 'maj7 significa mayor con séptima mayor: fundamental, tercera mayor, quinta justa y séptima mayor. Cmaj7 = C–E–G–B (Do–Mi–Sol–Si).' : 'En el cifrado, m indica menor, M o maj indica mayor, dim indica disminuido, aug o #5 indica quinta aumentada y sus reemplaza la tercera. Un 7 sin maj indica séptima menor.',
    /\/[A-G][#b]*$/.test(value) ? `La barra indica el bajo: en ${value}, ${value.split('/').pop()} es la nota más grave. La fundamental del acorde sigue siendo ${chord.tonic}.` : 'La fundamental da nombre al acorde. Las mismas notas pueden aparecer en distintas octavas e inversiones.',
    kind === 'arpeggio' ? 'En un arpegio las notas del acorde se reparten en el tiempo, en lugar de sonar todas a la vez. Esta detección propone una interpretación; las notas de paso pueden cambiarla.' : 'Para tocarlo como acorde, haz sonar sus notas simultáneamente. Para tocarlo como arpegio, repártelas en el tiempo.',
  ] };
}
