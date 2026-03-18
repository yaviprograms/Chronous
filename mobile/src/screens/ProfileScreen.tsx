import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Friendship,
  acceptFriendRequest,
  listFriends,
  removeFriendship,
  searchPeople,
  sendFriendRequest,
} from '../api/friends';
import { Button } from '../components/Button';
import { useCapsules } from '../store/CapsuleContext';
import { colors, radius, spacing } from '../theme';
import { UserProfile } from '../types';

export function ProfileScreen() {
  const {
    session,
    signOut,
    syncNow,
    isSyncing,
    apiError,
    profile,
  } = useCapsules();
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendQuery, setFriendQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendMessage, setFriendMessage] = useState('');

  const loadFriendships = useCallback(async () => {
    if (!session) return;
    try {
      setFriendships(await listFriends());
    } catch (error) {
      setFriendMessage(error instanceof Error ? error.message : 'Could not load friends.');
    }
  }, [session]);

  useEffect(() => {
    void loadFriendships();
  }, [loadFriendships]);

  const incoming = useMemo(
    () => friendships.filter((item) => item.status === 'pending' && item.direction === 'incoming'),
    [friendships],
  );
  const outgoing = useMemo(
    () => friendships.filter((item) => item.status === 'pending' && item.direction === 'outgoing'),
    [friendships],
  );
  const accepted = useMemo(
    () => friendships.filter((item) => item.status === 'accepted'),
    [friendships],
  );

  async function findPeople() {
    const query = friendQuery.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,40}$/.test(query)) {
      setFriendMessage('Enter a valid Chronous handle.');
      return;
    }
    setFriendBusy(true);
    setFriendMessage('');
    try {
      setSearchResults(await searchPeople(query));
    } catch (error) {
      setFriendMessage(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setFriendBusy(false);
    }
  }

  async function mutateFriendship(action: () => Promise<void>, success: string) {
    setFriendBusy(true);
    setFriendMessage('');
    try {
      await action();
      setFriendMessage(success);
      setSearchResults([]);
      await loadFriendships();
    } catch (error) {
      setFriendMessage(error instanceof Error ? error.message : 'The friend request failed.');
    } finally {
      setFriendBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR SPACE</Text>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.displayName || session?.user.email || 'C').charAt(0).toUpperCase()}
            </Text>
            <View style={styles.avatarBadge}>
              <Ionicons name="sparkles" size={11} color={colors.ink} />
            </View>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{profile?.displayName || 'Chronous keeper'}</Text>
            <Text style={styles.email}>
              {profile?.username ? `@${profile.username}` : session?.user.email ?? 'keeper of future moments'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
        </View>

        <View style={styles.syncCard}>
          <View style={[styles.syncIcon, { backgroundColor: `${colors.mint}18` }]}> 
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={colors.mint}
            />
          </View>
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>Secure API connected</Text>
            <Text style={styles.syncText}>All account and capsule traffic is routed through Chronous.</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: colors.mint }]} />
        </View>

        {session ? (
            <View style={styles.cloudAccount}>
              <View style={styles.cloudAccountHead}>
                <View>
                  <Text style={styles.groupLabel}>ACCOUNT</Text>
                  <Text style={styles.cloudEmail}>{session.user.email ?? 'Authenticated user'}</Text>
                </View>
                <View style={styles.connectedPill}>
                  <View style={styles.connectedDot} />
                  <Text style={styles.connectedText}>CONNECTED</Text>
                </View>
              </View>
              {apiError ? <Text style={styles.authError}>{apiError}</Text> : null}
              <View style={styles.cloudActions}>
                <Button
                  label={isSyncing ? 'Syncing...' : 'Sync now'}
                  icon="sync-outline"
                  variant="secondary"
                  loading={isSyncing}
                  onPress={() => void syncNow()}
                  style={styles.cloudButton}
                />
                <Button
                  label="Sign out"
                  variant="ghost"
                  onPress={() => void signOut()}
                  style={styles.cloudButton}
                />
              </View>
            </View>
          ) : null}

        <View>
          <View style={styles.friendsHeading}>
            <View>
              <Text style={styles.groupLabel}>FRIENDS</Text>
              <Text style={styles.friendsCount}>{accepted.length} connected</Text>
            </View>
            <Ionicons name="people-outline" size={20} color={colors.lavender} />
          </View>
          <View style={styles.friendsCard}>
            <View style={styles.friendSearch}>
              <Ionicons name="at-outline" size={18} color={colors.muted} />
              <TextInput
                value={friendQuery}
                onChangeText={setFriendQuery}
                onSubmitEditing={() => void findPeople()}
                placeholder="Search exact or partial handle"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.friendInput}
              />
              <Pressable onPress={() => void findPeople()} disabled={friendBusy} hitSlop={8}>
                <Ionicons name="search" size={19} color={colors.lavender} />
              </Pressable>
            </View>

            {friendMessage ? <Text style={styles.friendMessage}>{friendMessage}</Text> : null}

            {searchResults.map((person) => {
              const existing = friendships.find((item) => item.profile.id === person.id);
              return (
                <FriendRow
                  key={person.id}
                  profile={person}
                  action={existing ? (existing.status === 'accepted' ? 'FRIEND' : 'PENDING') : 'ADD'}
                  disabled={Boolean(existing) || friendBusy}
                  onPress={() =>
                    void mutateFriendship(
                      () => sendFriendRequest(person.username),
                      `Friend request sent to @${person.username}.`,
                    )
                  }
                />
              );
            })}

            {incoming.length ? <Text style={styles.friendSectionLabel}>REQUESTS</Text> : null}
            {incoming.map((item) => (
              <FriendRow
                key={item.id}
                profile={item.profile}
                action="ACCEPT"
                secondaryAction="DECLINE"
                disabled={friendBusy}
                onPress={() =>
                  void mutateFriendship(
                    () => acceptFriendRequest(item.id),
                    `You and @${item.profile.username} are now friends.`,
                  )
                }
                onSecondaryPress={() =>
                  void mutateFriendship(() => removeFriendship(item.id), 'Friend request declined.')
                }
              />
            ))}

            {outgoing.length ? <Text style={styles.friendSectionLabel}>SENT REQUESTS</Text> : null}
            {outgoing.map((item) => (
              <FriendRow
                key={item.id}
                profile={item.profile}
                action="CANCEL"
                disabled={friendBusy}
                onPress={() =>
                  void mutateFriendship(() => removeFriendship(item.id), 'Friend request cancelled.')
                }
              />
            ))}

            {accepted.length ? <Text style={styles.friendSectionLabel}>YOUR FRIENDS</Text> : null}
            {accepted.map((item) => (
              <FriendRow
                key={item.id}
                profile={item.profile}
                action="REMOVE"
                disabled={friendBusy}
                onPress={() =>
                  void mutateFriendship(
                    () => removeFriendship(item.id),
                    `@${item.profile.username} was removed.`,
                  )
                }
              />
            ))}

            {!incoming.length && !outgoing.length && !accepted.length && !searchResults.length ? (
              <Text style={styles.friendEmpty}>Search for a Chronous handle to add your first friend.</Text>
            ) : null}
          </View>
        </View>

        <SettingsGroup label="PRIVACY & SECURITY">
          <SettingRow
            icon="finger-print-outline"
            color={colors.lavender}
            title="Biometric lock"
            subtitle="Planned for a production device build"
            trailing={<Text style={styles.plannedText}>PLANNED</Text>}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            color={colors.mint}
            title="Trusted-time protection"
            subtitle="Server-verified unlock dates"
            trailing={<Text style={styles.activeText}>ACTIVE</Text>}
            last
          />
        </SettingsGroup>

        <SettingsGroup label="EXPERIENCE">
          <SettingRow
            icon="notifications-outline"
            color={colors.amber}
            title="Unlock reminders"
            subtitle="Choose separately for each capsule"
            trailing={<Text style={styles.activeText}>PER CAPSULE</Text>}
          />
          <SettingRow
            icon="color-palette-outline"
            color={colors.peach}
            title="Appearance"
            subtitle="Midnight"
            trailing={<Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            last
          />
        </SettingsGroup>

        <View style={styles.footer}>
          <View style={styles.footerMark}>
            <Ionicons name="hourglass-outline" size={16} color={colors.ink} />
          </View>
          <Text style={styles.footerText}>CHRONOUS · VERSION 1.0.0</Text>
          <Text style={styles.footerSub}>Made for the person you are becoming.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FriendRow({
  profile,
  action,
  secondaryAction,
  disabled,
  onPress,
  onSecondaryPress,
}: {
  profile: UserProfile;
  action: string;
  secondaryAction?: string;
  disabled?: boolean;
  onPress: () => void;
  onSecondaryPress?: () => void;
}) {
  return (
    <View style={styles.friendRow}>
      <View style={styles.friendAvatar}>
        <Text style={styles.friendAvatarText}>{profile.displayName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.friendCopy}>
        <Text style={styles.friendName}>{profile.displayName}</Text>
        <Text style={styles.friendHandle}>@{profile.username}</Text>
      </View>
      {secondaryAction ? (
        <Pressable disabled={disabled} onPress={onSecondaryPress} hitSlop={6}>
          <Text style={styles.friendSecondaryAction}>{secondaryAction}</Text>
        </Pressable>
      ) : null}
      <Pressable disabled={disabled} onPress={onPress} hitSlop={6}>
        <Text style={[styles.friendAction, disabled && styles.friendActionDisabled]}>{action}</Text>
      </Pressable>
    </View>
  );
}

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function SettingRow({
  icon,
  color,
  title,
  subtitle,
  trailing,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  trailing: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, last && styles.lastRow, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: 116, gap: spacing.lg },
  header: { marginBottom: 2 },
  eyebrow: { color: colors.lavender, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.cream, fontSize: 31, fontWeight: '700', letterSpacing: -0.8, marginTop: 4 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 17,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: colors.lavenderDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 21, fontWeight: '800' },
  avatarBadge: {
    position: 'absolute',
    width: 20,
    height: 20,
    right: -4,
    bottom: -3,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.panel,
  },
  identityCopy: { flex: 1, gap: 4 },
  name: { color: colors.cream, fontSize: 18, fontWeight: '700' },
  email: { color: colors.muted, fontSize: 10 },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  syncIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  syncCopy: { flex: 1, gap: 4 },
  syncTitle: { color: colors.cream, fontSize: 12, fontWeight: '700' },
  syncText: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cloudAccount: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.mint}35`,
    backgroundColor: `${colors.mint}09`,
    gap: 13,
  },
  cloudAccountHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cloudEmail: { color: colors.cream, fontSize: 13, fontWeight: '700', marginTop: 3 },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.round,
    backgroundColor: `${colors.mint}14`,
  },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mint },
  connectedText: { color: colors.mint, fontSize: 7, fontWeight: '800', letterSpacing: 1 },
  cloudActions: { flexDirection: 'row', gap: 8 },
  cloudButton: { flex: 1 },
  authCard: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    gap: 11,
  },
  authTitle: { color: colors.cream, fontSize: 15, fontWeight: '700', marginTop: 4 },
  authInput: {
    minHeight: 49,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.inkSoft,
    color: colors.cream,
    paddingHorizontal: 14,
    fontSize: 12,
  },
  authError: { color: colors.peach, fontSize: 10, lineHeight: 15 },
  authSwitch: { alignItems: 'center', paddingVertical: 5 },
  authSwitchText: { color: colors.lavender, fontSize: 10, fontWeight: '700' },
  friendsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  friendsCount: { color: colors.cream, fontSize: 13, fontWeight: '700', marginLeft: 3 },
  friendsCard: {
    marginTop: 9,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    gap: 10,
  },
  friendSearch: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.inkSoft,
  },
  friendInput: { flex: 1, color: colors.cream, fontSize: 12, paddingVertical: 12 },
  friendMessage: { color: colors.mint, fontSize: 10, lineHeight: 15 },
  friendSectionLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 5 },
  friendRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderDeep,
  },
  friendAvatarText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  friendCopy: { flex: 1, gap: 2 },
  friendName: { color: colors.cream, fontSize: 12, fontWeight: '700' },
  friendHandle: { color: colors.muted, fontSize: 9 },
  friendAction: { color: colors.lavender, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  friendActionDisabled: { color: colors.muted },
  friendSecondaryAction: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  friendEmpty: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 16, paddingVertical: 8 },
  groupLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.4, marginBottom: 9, marginLeft: 3 },
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.cream, fontSize: 12, fontWeight: '700' },
  rowSubtitle: { color: colors.muted, fontSize: 9 },
  activeText: { color: colors.mint, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  plannedText: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  pressed: { opacity: 0.7 },
  footer: { alignItems: 'center', gap: 6, paddingTop: 8 },
  footerMark: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  footerText: { color: colors.muted, fontSize: 7, fontWeight: '800', letterSpacing: 1.2 },
  footerSub: { color: colors.muted, fontSize: 9, fontStyle: 'italic' },
});
