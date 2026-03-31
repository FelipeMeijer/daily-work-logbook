import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Text,
  Surface,
  Button,
  Checkbox,
  TextInput,
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { useDashboardStore } from '@/src/store/dashboardStore';
import { useLogStore } from '@/src/store/logStore';

function formatTime(iso: string | null): string {
  if (!iso) return '--:--';
  return format(parseISO(iso), 'HH:mm');
}

function formatElapsed(startIso: string | null, endIso: string | null): string {
  if (!startIso) return '0h 0m';
  const end = endIso ? parseISO(endIso) : new Date();
  const mins = differenceInMinutes(end, parseISO(startIso));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), 'EEEE, MMMM d');

  const { checkIn, actionItems, fetchCheckIn, checkIn: doCheckIn, checkOut: doCheckOut, fetchActionItems, addActionItem, toggleActionItem, deleteActionItem } = useDashboardStore();
  const { entries, fetchEntry } = useLogStore();
  const todayEntry = entries[today];

  const [newItem, setNewItem] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    fetchCheckIn(today);
    fetchActionItems();
    fetchEntry(today);
  }, []);

  async function handleAddItem() {
    if (!newItem.trim()) return;
    setAddingItem(true);
    try {
      await addActionItem(newItem.trim());
      setNewItem('');
    } finally {
      setAddingItem(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.dateText}>{todayLabel}</Text>
        <IconButton
          icon="cog"
          iconColor="#888"
          size={22}
          onPress={() => router.push('/settings')}
        />
      </View>

      {/* Check-in card */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.cardTitle}>Work Hours</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Start</Text>
            <Text style={styles.timeValue}>{formatTime(checkIn?.startTime ?? null)}</Text>
          </View>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>End</Text>
            <Text style={styles.timeValue}>{formatTime(checkIn?.endTime ?? null)}</Text>
          </View>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Total</Text>
            <Text style={styles.timeValue}>{formatElapsed(checkIn?.startTime ?? null, checkIn?.endTime ?? null)}</Text>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            onPress={() => doCheckIn().catch((e) => Alert.alert('Error', e.message))}
            disabled={!!checkIn?.startTime}
            style={styles.halfButton}
          >
            Start Work
          </Button>
          <Button
            mode="outlined"
            onPress={() => doCheckOut().catch((e) => Alert.alert('Error', e.message))}
            disabled={!checkIn?.startTime || !!checkIn?.endTime}
            style={styles.halfButton}
          >
            End Work
          </Button>
        </View>
      </Surface>

      {/* Today's log card */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.cardTitle}>Today's Log</Text>
        {todayEntry?.content ? (
          <Text style={styles.preview} numberOfLines={3}>{todayEntry.content}</Text>
        ) : (
          <Text style={styles.empty}>Nothing written yet.</Text>
        )}
        <Button
          mode="text"
          onPress={() => router.push('/(tabs)/log')}
          style={{ alignSelf: 'flex-start', marginTop: 4 }}
        >
          {todayEntry?.content ? 'Edit entry' : 'Write now'}
        </Button>
      </Surface>

      {/* Action items card */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.cardTitle}>Action Items</Text>
        {actionItems.length === 0 && (
          <Text style={styles.empty}>No open tasks.</Text>
        )}
        {actionItems.map((item) => (
          <View key={item.id} style={styles.actionRow}>
            <Checkbox
              status={item.completed ? 'checked' : 'unchecked'}
              onPress={() => toggleActionItem(item.id)}
              color="#6C63FF"
            />
            <Text
              style={[styles.actionText, item.completed && styles.completedText]}
              onPress={() => toggleActionItem(item.id)}
            >
              {item.text}
            </Text>
            <IconButton
              icon="close"
              size={16}
              iconColor="#555"
              onPress={() => deleteActionItem(item.id)}
            />
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Add a task..."
            placeholderTextColor="#555"
            mode="outlined"
            dense
            style={styles.addInput}
            onSubmitEditing={handleAddItem}
          />
          <Button onPress={handleAddItem} loading={addingItem} disabled={!newItem.trim()}>
            Add
          </Button>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dateText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { color: '#fff', fontWeight: '600', marginBottom: 12 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  timeBox: { alignItems: 'center' },
  timeLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  timeValue: { color: '#fff', fontSize: 18, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 8 },
  halfButton: { flex: 1 },
  preview: { color: '#ccc', lineHeight: 22 },
  empty: { color: '#555', fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  actionText: { flex: 1, color: '#ccc' },
  completedText: { textDecorationLine: 'line-through', color: '#555' },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  addInput: { flex: 1, backgroundColor: '#242424' },
});
