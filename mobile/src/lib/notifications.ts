import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Capsule } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function scheduleUnlockReminder(capsule: Capsule): Promise<string | undefined> {
  if (Platform.OS === 'web' || !capsule.reminderEnabled) return undefined;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('capsule-unlocks', {
      name: 'Capsule unlocks',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: capsule.accent,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return undefined;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'A message from your past is ready ✦',
      body: `“${capsule.title}” has arrived. Open it when you are ready.`,
      data: { capsuleId: capsule.id },
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(capsule.unlockAt),
      channelId: Platform.OS === 'android' ? 'capsule-unlocks' : undefined,
    },
  });
}

export async function cancelAllUnlockReminders(): Promise<void> {
  if (Platform.OS !== 'web') {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
