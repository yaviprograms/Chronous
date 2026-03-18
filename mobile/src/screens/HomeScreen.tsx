import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CapsuleCard } from '../components/CapsuleCard';
import { useCapsules } from '../store/CapsuleContext';
import { Capsule } from '../types';
import { colors, radius, spacing } from '../theme';
import { getCountdown } from '../utils/time';

export function HomeScreen({
  onOpen,
  onCreate,
  onProfile,
}: {
  onOpen: (capsule: Capsule) => void;
  onCreate: () => void;
  onProfile: () => void;
}) {
  const { capsules, profile, session } = useCapsules();
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
    .format(new Date())
    .toUpperCase();
  const { featured, upcoming, sealedCount, openedCount } = useMemo(() => {
    const future = capsules
      .filter((item) => item.status !== 'opened')
      .sort((a, b) => new Date(a.unlockAt).getTime() - new Date(b.unlockAt).getTime());
    return {
      featured: future[0] ?? capsules[0],
      upcoming: future.slice(1, 4),
      sealedCount: future.length,
      openedCount: capsules.filter((item) => item.status === 'opened').length,
    };
  }, [capsules]);

  const daysToNext = featured ? getCountdown(featured.unlockAt).days : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.displayName.split(/\s+/)[0] || session?.user.email?.split('@')[0] || 'keeper';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Ionicons name="hourglass-outline" size={18} color={colors.ink} />
            </View>
            <Text style={styles.brandText}>chronous</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            style={styles.avatar}
            onPress={onProfile}
          >
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            <View style={styles.onlineDot} />
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={styles.kicker}>{todayLabel.replace(', ', ' · ')}</Text>
          <Text style={styles.greeting}>{greeting}, {firstName}.</Text>
          <Text style={styles.introCopy}>Your future is holding a few things for you.</Text>
        </View>

        {featured ? <CapsuleCard capsule={featured} featured onPress={() => onOpen(featured)} /> : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: `${colors.lavender}20` }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.lavender} />
            </View>
            <Text style={styles.statValue}>{sealedCount}</Text>
            <Text style={styles.statLabel}>sealed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: `${colors.mint}20` }]}>
              <Ionicons name="lock-open-outline" size={18} color={colors.mint} />
            </View>
            <Text style={styles.statValue}>{openedCount}</Text>
            <Text style={styles.statLabel}>opened</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: `${colors.peach}20` }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.peach} />
            </View>
            <Text style={styles.statValue}>{daysToNext}</Text>
            <Text style={styles.statLabel}>days to next</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>ON THE HORIZON</Text>
            <Text style={styles.sectionTitle}>Coming up</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.muted} />
        </View>

        <View style={styles.list}>
          {upcoming.map((capsule) => (
            <CapsuleCard key={capsule.id} capsule={capsule} onPress={() => onOpen(capsule)} />
          ))}
        </View>

        <Pressable onPress={onCreate} style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}>
          <View style={styles.promptIcon}>
            <Ionicons name="create-outline" size={22} color={colors.ink} />
          </View>
          <View style={styles.promptCopy}>
            <Text style={styles.promptTitle}>What should your future remember?</Text>
            <Text style={styles.promptText}>Capture one honest thought before today ends.</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: 116, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  brandText: { color: colors.cream, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.panelLight,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.cream, fontSize: 13, fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.mint,
    right: -1,
    bottom: 1,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  intro: { gap: 6, marginTop: 3 },
  kicker: { color: colors.lavender, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  greeting: { color: colors.cream, fontSize: 29, fontWeight: '700', letterSpacing: -0.7 },
  introCopy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  warning: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: `${colors.amber}10`,
    borderWidth: 1,
    borderColor: `${colors.amber}40`,
    flexDirection: 'row',
    gap: 12,
  },
  warningCopy: { flex: 1, gap: 3 },
  warningTitle: { color: colors.amber, fontSize: 12, fontWeight: '800' },
  warningText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { color: colors.cream, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  statDivider: { width: 1, height: 45, backgroundColor: colors.line },
  sectionHeader: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  sectionTitle: { color: colors.cream, fontSize: 22, fontWeight: '700', marginTop: 4 },
  list: { gap: 11 },
  prompt: {
    borderRadius: radius.lg,
    padding: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  promptIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptCopy: { flex: 1, gap: 4 },
  promptTitle: { color: colors.cream, fontSize: 13, fontWeight: '700' },
  promptText: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
