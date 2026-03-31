import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { Text, Surface, Switch, Button, Divider, List, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { format, subDays } from 'date-fns';
import { useAuthStore } from '@/src/store/authStore';
import { API_URL, getToken, api } from '@/src/lib/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [oneDriveConnected, setOneDriveConnected] = useState(false);
  const [oneDriveLoading, setOneDriveLoading] = useState(true);

  useEffect(() => {
    api.get<{ connected: boolean }>('/onedrive/status')
      .then((res) => setOneDriveConnected(res.connected))
      .catch(() => setOneDriveConnected(false))
      .finally(() => setOneDriveLoading(false));
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const token = await getToken();
      const from = format(subDays(new Date(), 365), 'yyyy-MM-dd');
      const to = format(new Date(), 'yyyy-MM-dd');
      const url = `${API_URL}/export?from=${from}&to=${to}`;

      const dest = FileSystem.documentDirectory + `logbook-export-${to}.zip`;
      const { uri } = await FileSystem.downloadAsync(url, dest, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/zip' });
      } else {
        Alert.alert('Exported', `Saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleConnectOneDrive() {
    const token = await getToken();
    const authUrl = `${API_URL}/onedrive/auth`;
    // Open backend OAuth redirect in browser; Microsoft will redirect back to APP_URL/onedrive/callback
    await WebBrowser.openBrowserAsync(authUrl + `?jwt=${token}`);
    // Re-check status after browser closes
    setOneDriveLoading(true);
    api.get<{ connected: boolean }>('/onedrive/status')
      .then((res) => setOneDriveConnected(res.connected))
      .catch(() => {})
      .finally(() => setOneDriveLoading(false));
  }

  async function handleDisconnectOneDrive() {
    Alert.alert('Disconnect OneDrive', 'Entries will no longer sync to OneDrive. Existing files are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await api.delete('/onedrive/disconnect');
          setOneDriveConnected(false);
        },
      },
    ]);
  }

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Surface style={styles.section} elevation={1}>
        <List.Item
          title="Account"
          description={user?.email ?? ''}
          titleStyle={styles.sectionTitle}
          descriptionStyle={styles.description}
          left={(props) => <List.Icon {...props} icon="account" color="#6C63FF" />}
        />
      </Surface>

      <Surface style={styles.section} elevation={1}>
        <Text variant="labelLarge" style={styles.sectionHeader}>Notifications</Text>
        <Divider style={styles.divider} />
        <List.Item
          title="Push notifications"
          description="Daily reminder on your phone"
          titleStyle={styles.itemTitle}
          descriptionStyle={styles.description}
          right={() => (
            <Switch value={pushEnabled} onValueChange={setPushEnabled} color="#6C63FF" />
          )}
        />
        <List.Item
          title="Email reminders"
          description="Daily reminder via email"
          titleStyle={styles.itemTitle}
          descriptionStyle={styles.description}
          right={() => (
            <Switch value={emailEnabled} onValueChange={setEmailEnabled} color="#6C63FF" />
          )}
        />
      </Surface>

      <Surface style={styles.section} elevation={1}>
        <Text variant="labelLarge" style={styles.sectionHeader}>Integrations</Text>
        <Divider style={styles.divider} />
        <List.Item
          title="OneDrive sync"
          description={
            oneDriveLoading
              ? 'Checking...'
              : oneDriveConnected
              ? 'Connected — entries sync automatically'
              : 'Not connected'
          }
          titleStyle={styles.itemTitle}
          descriptionStyle={oneDriveConnected ? styles.connectedText : styles.description}
          left={(props) => <List.Icon {...props} icon="microsoft-onedrive" color="#0078D4" />}
          right={() =>
            oneDriveLoading ? (
              <ActivityIndicator size={16} color="#6C63FF" style={{ marginRight: 8 }} />
            ) : (
              <Button
                mode={oneDriveConnected ? 'outlined' : 'contained'}
                compact
                onPress={oneDriveConnected ? handleDisconnectOneDrive : handleConnectOneDrive}
                labelStyle={{ fontSize: 12 }}
                buttonColor={oneDriveConnected ? 'transparent' : '#0078D4'}
                textColor={oneDriveConnected ? '#ff4444' : '#fff'}
                style={{ borderColor: oneDriveConnected ? '#ff4444' : undefined }}
              >
                {oneDriveConnected ? 'Disconnect' : 'Connect'}
              </Button>
            )
          }
        />
      </Surface>

      <Surface style={styles.section} elevation={1}>
        <Text variant="labelLarge" style={styles.sectionHeader}>Data</Text>
        <Divider style={styles.divider} />
        <List.Item
          title="Export logs"
          description="Download all entries as Markdown zip"
          titleStyle={styles.itemTitle}
          descriptionStyle={styles.description}
          left={(props) => <List.Icon {...props} icon="download" color="#6C63FF" />}
          onPress={handleExport}
          right={() =>
            exporting ? (
              <Text style={styles.description}>Exporting...</Text>
            ) : null
          }
        />
      </Surface>

      <Button
        mode="outlined"
        onPress={handleLogout}
        style={styles.logoutButton}
        labelStyle={{ color: '#ff4444' }}
        buttonColor="transparent"
      >
        Log out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: '#1a1a1a', borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  sectionHeader: { color: '#888', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 },
  sectionTitle: { color: '#fff', fontWeight: '600' },
  itemTitle: { color: '#fff' },
  description: { color: '#888' },
  divider: { backgroundColor: '#242424' },
  logoutButton: { borderColor: '#ff4444', marginTop: 8 },
});
