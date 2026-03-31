import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Searchbar, Chip, ActivityIndicator, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useLogStore, LogEntry } from '@/src/store/logStore';

function EntryCard({ entry, onPress }: { entry: LogEntry; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Surface style={styles.card} elevation={1}>
        <Text style={styles.entryDate}>{format(parseISO(entry.date), 'EEE, MMM d yyyy')}</Text>
        {entry.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {entry.tags.map((tag) => (
              <Chip key={tag} style={styles.chip} textStyle={styles.chipText} compact>
                #{tag}
              </Chip>
            ))}
          </View>
        )}
        <Text style={styles.preview} numberOfLines={3}>
          {entry.content || <Text style={styles.empty}>No content.</Text>}
        </Text>
      </Surface>
    </TouchableOpacity>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { feed, isLoading, fetchFeed } = useLogStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadFeed(1, '');
  }, []);

  async function loadFeed(p: number, q: string) {
    const prevLen = feed.length;
    await fetchFeed({ search: q, page: p });
    if (feed.length === prevLen && p > 1) setHasMore(false);
  }

  function handleSearch(q: string) {
    setSearch(q);
    setPage(1);
    setHasMore(true);
    fetchFeed({ search: q, page: 1 });
  }

  function handleRefresh() {
    setPage(1);
    setHasMore(true);
    fetchFeed({ search, page: 1 });
  }

  function handleEndReached() {
    if (!isLoading && hasMore) {
      const next = page + 1;
      setPage(next);
      loadFeed(next, search);
    }
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search entries..."
        value={search}
        onChangeText={handleSearch}
        style={styles.searchbar}
        inputStyle={{ color: '#fff' }}
        iconColor="#888"
        placeholderTextColor="#555"
      />
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            onPress={() => router.push({ pathname: '/(tabs)/log', params: { date: item.date } })}
          />
        )}
        onRefresh={handleRefresh}
        refreshing={isLoading && page === 1}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.empty}>No entries found.</Text> : null
        }
        ListFooterComponent={
          isLoading && page > 1 ? <ActivityIndicator style={{ margin: 16 }} color="#6C63FF" /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  searchbar: { margin: 12, backgroundColor: '#1a1a1a', borderRadius: 10 },
  list: { padding: 12, paddingTop: 0, paddingBottom: 32 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 12 },
  entryDate: { color: '#6C63FF', fontWeight: '600', marginBottom: 6 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { backgroundColor: '#242424' },
  chipText: { color: '#aaa', fontSize: 11 },
  preview: { color: '#ccc', lineHeight: 20, fontSize: 14 },
  empty: { color: '#555', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
});
