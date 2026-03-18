import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { VaultScreen } from './screens/VaultScreen';
import { CreateScreen } from './screens/CreateScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { CapsuleDetailScreen } from './screens/CapsuleDetailScreen';
import { CollaborativeDraftScreen } from './screens/CollaborativeDraftScreen';
import { AuthMode, AuthScreen } from './screens/AuthScreen';
import { LandingScreen } from './screens/LandingScreen';
import { useCapsules } from './store/CapsuleContext';
import { AppScreen, Capsule } from './types';
import { colors } from './theme';

export function ChronousApp() {
  const { capsules, isLoading, isAuthReady, session } = useCapsules();
  const [screen, setScreen] = useState<AppScreen>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  const selectedCapsule = useMemo(
    () => capsules.find((capsule) => capsule.id === selectedId) ?? null,
    [capsules, selectedId],
  );

  useEffect(() => {
    function openFromNotification(response: Notifications.NotificationResponse | null) {
      const capsuleId = response?.notification.request.content.data?.capsuleId;
      if (typeof capsuleId === 'string') setSelectedId(capsuleId);
    }

    openFromNotification(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (session) {
      setAuthMode(null);
      setSelectedId(null);
      setScreen('home');
    }
  }, [session?.user.id]);

  function openCapsule(capsule: Capsule) {
    setSelectedId(capsule.id);
  }

  if (isLoading || !isAuthReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.lavender} />
      </View>
    );
  }

  if (!session) {
    return authMode ? (
      <AuthScreen mode={authMode} onBack={() => setAuthMode(null)} onModeChange={setAuthMode} />
    ) : (
      <LandingScreen onSignIn={() => setAuthMode('signIn')} onSignUp={() => setAuthMode('signUp')} />
    );
  }

  if (selectedCapsule) {
    return selectedCapsule.status === 'draft' ? (
      <CollaborativeDraftScreen capsule={selectedCapsule} onBack={() => setSelectedId(null)} />
    ) : (
      <CapsuleDetailScreen capsule={selectedCapsule} onBack={() => setSelectedId(null)} />
    );
  }

  return (
    <View style={styles.root}>
      {screen === 'home' ? (
        <HomeScreen
          onOpen={openCapsule}
          onCreate={() => setScreen('create')}
          onProfile={() => setScreen('profile')}
        />
      ) : screen === 'vault' ? (
        <VaultScreen onOpen={openCapsule} />
      ) : screen === 'create' ? (
        <CreateScreen onCreated={openCapsule} />
      ) : screen === 'insights' ? (
        <InsightsScreen />
      ) : (
        <ProfileScreen />
      )}
      <BottomNav active={screen} onChange={setScreen} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  loading: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
