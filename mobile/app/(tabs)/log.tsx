import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput as RNTextInput } from 'react-native';
import { Text, Chip, IconButton, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { useLogStore } from '@/src/store/logStore';

type SaveStatus = 'idle' | 'saving' | 'saved';

export default function LogScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [currentDate, setCurrentDate] = useState(params.date ?? format(new Date(), 'yyyy-MM-dd'));
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { entries, fetchEntry, saveEntry } = useLogStore();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ title: format(parseISO(currentDate), 'MMMM d, yyyy') });
  }, [currentDate]);

  useEffect(() => {
    fetchEntry(currentDate);
  }, [currentDate]);

  useEffect(() => {
    const entry = entries[currentDate];
    if (entry) {
      setContent(entry.content);
      setTags(entry.tags);
    } else {
      setContent('');
      setTags([]);
    }
    setSaveStatus('idle');
  }, [currentDate, entries[currentDate]?.id]);

  function handleContentChange(text: string) {
    setContent(text);
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveEntry(currentDate, text, tags);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 1000);
  }

  async function handleAddTag() {
    const tag = newTag.trim().replace(/^#/, '');
    if (!tag || tags.includes(tag)) { setNewTag(''); setShowTagInput(false); return; }
    const updated = [...tags, tag];
    setTags(updated);
    setNewTag('');
    setShowTagInput(false);
    await saveEntry(currentDate, content, updated).catch(() => null);
  }

  async function handleRemoveTag(tag: string) {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    await saveEntry(currentDate, content, updated).catch(() => null);
  }

  function goToPrev() { setCurrentDate(format(subDays(parseISO(currentDate), 1), 'yyyy-MM-dd')); }
  function goToNext() {
    const next = addDays(parseISO(currentDate), 1);
    if (next <= new Date()) setCurrentDate(format(next, 'yyyy-MM-dd'));
  }

  const saveLabel = saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : '';

  return (
    <View style={styles.container}>
      {/* Date navigation */}
      <View style={styles.dateNav}>
        <IconButton icon="chevron-left" iconColor="#fff" onPress={goToPrev} />
        <Text variant="titleMedium" style={styles.dateLabel}>
          {format(parseISO(currentDate), 'EEE, MMM d')}
        </Text>
        <IconButton icon="chevron-right" iconColor="#fff" onPress={goToNext} />
        <Text style={styles.saveStatus}>{saveLabel}</Text>
      </View>

      {/* Tags */}
      <ScrollView horizontal style={styles.tagsRow} showsHorizontalScrollIndicator={false}>
        {tags.map((tag) => (
          <Chip
            key={tag}
            onClose={() => handleRemoveTag(tag)}
            style={styles.chip}
            textStyle={styles.chipText}
          >
            #{tag}
          </Chip>
        ))}
        {showTagInput ? (
          <TextInput
            value={newTag}
            onChangeText={setNewTag}
            onSubmitEditing={handleAddTag}
            onBlur={handleAddTag}
            placeholder="#tag"
            placeholderTextColor="#555"
            mode="flat"
            dense
            autoFocus
            style={styles.tagInput}
          />
        ) : (
          <Chip
            icon="plus"
            onPress={() => setShowTagInput(true)}
            style={[styles.chip, styles.addChip]}
            textStyle={styles.chipText}
          >
            Add tag
          </Chip>
        )}
      </ScrollView>

      {/* Editor */}
      <RNTextInput
        value={content}
        onChangeText={handleContentChange}
        multiline
        placeholder="What did you work on today?"
        placeholderTextColor="#444"
        style={styles.editor}
        textAlignVertical="top"
        selectionColor="#6C63FF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  dateNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#0f0f0f' },
  dateLabel: { color: '#fff', flex: 1, textAlign: 'center' },
  saveStatus: { color: '#6C63FF', fontSize: 12, width: 70, textAlign: 'right', marginRight: 4 },
  tagsRow: { paddingHorizontal: 16, paddingVertical: 8, maxHeight: 52 },
  chip: { marginRight: 8, backgroundColor: '#242424' },
  addChip: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  chipText: { color: '#aaa', fontSize: 12 },
  tagInput: { backgroundColor: '#242424', width: 100, height: 36 },
  editor: {
    flex: 1,
    padding: 16,
    color: '#e0e0e0',
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'monospace',
    backgroundColor: '#0f0f0f',
  },
});
