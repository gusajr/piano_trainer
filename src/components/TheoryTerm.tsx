import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ReactNode } from 'react';
import type { TheoryTopic } from '../services/theoryExplainer';
import { explainTheory } from '../services/theoryExplainer';

export default function TheoryTerm({ topic, children }: { topic: TheoryTopic; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const explanation = useMemo(() => open ? explainTheory(topic) : null, [open, topic]);
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explicar ${topic.value}`}
      onPress={() => setOpen(true)} style={styles.term}>
      <Text style={styles.link}>{children ?? topic.value} ⓘ</Text>
    </TouchableOpacity>
    {open && <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>{explanation?.title}</Text>
            {explanation?.paragraphs.map((p, i) => <Text key={i} style={styles.body}>{p}</Text>)}
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}>
            <Text style={styles.link}>Cerrar explicación</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>}
  </>;
}

const styles = StyleSheet.create({
  term: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  link: { color: '#CDA6FF', fontSize: 14, lineHeight: 22, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: '#000B', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 540, maxHeight: '85%', backgroundColor: '#252538', borderRadius: 16, overflow: 'hidden' },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 21, fontWeight: '800', color: '#BB86FC' },
  body: { fontSize: 16, lineHeight: 25, color: '#E0E0E0' },
  close: { minHeight: 48, padding: 12, alignItems: 'center', backgroundColor: '#393050' },
});
