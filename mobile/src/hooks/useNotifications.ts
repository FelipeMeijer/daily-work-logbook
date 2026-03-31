import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '@/src/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_TIME_KEY = 'reminder_time'; // stored as "HH:MM"
const DEFAULT_REMINDER_TIME = '17:00';
const NOTIFICATION_ID_KEY = 'daily_reminder_notification_id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices.');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permission not granted.');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', {
      name: 'Daily Reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  return true;
}

async function getExpoPushToken(): Promise<string | null> {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (err) {
    console.error('Failed to get Expo push token:', err);
    return null;
  }
}

async function registerTokenWithBackend(token: string): Promise<void> {
  try {
    await api.post('/notifications/register', { token, platform: Platform.OS });
  } catch (err) {
    console.error('Failed to register push token with backend:', err);
  }
}

async function scheduleDailyReminder(timeString: string): Promise<void> {
  // Cancel any existing scheduled reminder
  const existingId = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  }

  const [hourStr, minuteStr] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (isNaN(hour) || isNaN(minute)) {
    console.warn('Invalid reminder time:', timeString);
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Work Logbook Reminder',
      body: "Don't forget to write your daily work log!",
      sound: 'default',
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });

  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
}

export function useNotifications() {
  useEffect(() => {
    let mounted = true;

    async function setup() {
      const granted = await requestPermissions();
      if (!granted || !mounted) return;

      const pushToken = await getExpoPushToken();
      if (pushToken && mounted) {
        await registerTokenWithBackend(pushToken);
      }

      const reminderTime =
        (await AsyncStorage.getItem(REMINDER_TIME_KEY)) ?? DEFAULT_REMINDER_TIME;

      if (mounted) {
        await scheduleDailyReminder(reminderTime);
      }
    }

    setup();

    return () => {
      mounted = false;
    };
  }, []);

  async function updateReminderTime(time: string): Promise<void> {
    await AsyncStorage.setItem(REMINDER_TIME_KEY, time);
    await scheduleDailyReminder(time);
  }

  async function getReminderTime(): Promise<string> {
    return (await AsyncStorage.getItem(REMINDER_TIME_KEY)) ?? DEFAULT_REMINDER_TIME;
  }

  return { updateReminderTime, getReminderTime };
}
