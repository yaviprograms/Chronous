import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCapsules } from '../store/CapsuleContext';
import { colors, radius, spacing } from '../theme';

export function InsightsScreen() {
  const { capsules } = useCapsules();
  const stats = useMemo(() => {
    const totalGoals = capsules.reduce((sum, item) => sum + item.goals.length, 0);
    const completeGoals = capsules.reduce(
      (sum, item) => sum + item.goals.filter((goal) => goal.completed).length,
      0,
    );
    const totalMemories = capsules.reduce(
      (sum, item) => sum + item.photos.length + (item.letter ? 1 : 0),
      0,
    );
    const horizons = capsules
      .filter((item) => item.status !== 'opened')
      .map((item) => new Date(item.unlockAt).getFullYear());
    return {
      totalGoals,
      completeGoals,
      totalMemories,
      farthestYear: horizons.length ? Math.max(...horizons) : new Date().getFullYear(),
    };
  }, [capsules]);

  const types = [
    { label: 'Letters', value: capsules.filter((item) => item.type === 'letter').length, color: colors.lavender },
    { label: 'Goals', value: capsules.filter((item) => item.type === 'goals').length, color: colors.mint },
    { label: 'Memories', value: capsules.filter((item) => item.type === 'memories').length, color: colors.peach },
    { label: 'Predictions', value: capsules.filter((item) => item.type === 'predictions').length, color: colors.sky },
  ];
  const maxValue = Math.max(1, ...types.map((item) => item.value));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.eyebrow}>YOUR STORY IN MOTION</Text>
          <Text style={styles.title}>The journey</Text>
          <Text style={styles.subtitle}>A quiet record of who you were and who you are becoming.</Text>
        </View>

        <View style={styles.heroStat}>
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <Text style={styles.ringValue}>{capsules.length}</Text>
              <Text style={styles.ringLabel}>MOMENTS</Text>
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>YOUR TIME HORIZON</Text>
            <Text style={styles.heroTitle}>You are writing to {stats.farthestYear}.</Text>
            <Text style={styles.heroText}>
              Every capsule is a small vote of confidence in the person waiting there.
            </Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <Metric icon="flag-outline" value={stats.totalGoals} label="promises made" color={colors.mint} />
          <Metric icon="checkmark-done-outline" value={stats.completeGoals} label="kept so far" color={colors.sky} />
          <Metric icon="heart-outline" value={stats.totalMemories} label="memories saved" color={colors.peach} />
        </View>

        <View style={styles.chart}>
          <View style={styles.chartHead}>
            <View>
              <Text style={styles.sectionKicker}>YOUR CAPSULE MIX</Text>
              <Text style={styles.sectionTitle}>What you preserve</Text>
            </View>
            <Ionicons name="analytics-outline" size={20} color={colors.muted} />
          </View>
          <View style={styles.bars}>
            {types.map((item) => (
              <View key={item.label} style={styles.barRow}>
                <Text style={styles.barLabel}>{item.label}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(7, (item.value / maxValue) * 100)}%`, backgroundColor: item.color },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.quote}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText}>
            The future is not some place we are going, but one we are creating.
          </Text>
          <Text style={styles.quoteAuthor}>— JOHN SCHAAR</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={19} color={color} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: 116, gap: spacing.lg },
  eyebrow: { color: colors.lavender, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.cream, fontSize: 31, fontWeight: '700', letterSpacing: -0.8, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: '90%' },
  heroStat: {
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  ringOuter: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 9,
    borderColor: `${colors.lavender}35`,
    borderTopColor: colors.lavender,
    borderRightColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-18deg' }],
  },
  ringInner: { alignItems: 'center', transform: [{ rotate: '18deg' }] },
  ringValue: { color: colors.cream, fontSize: 27, fontWeight: '800' },
  ringLabel: { color: colors.muted, fontSize: 7, fontWeight: '800', letterSpacing: 1 },
  heroCopy: { flex: 1, gap: 5 },
  heroKicker: { color: colors.lavender, fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: colors.cream, fontSize: 18, lineHeight: 22, fontWeight: '700' },
  heroText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  metricRow: { flexDirection: 'row', gap: 9 },
  metric: {
    flex: 1,
    minHeight: 108,
    borderRadius: radius.lg,
    padding: 13,
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  metricValue: { color: colors.cream, fontSize: 21, fontWeight: '800', marginTop: 3 },
  metricLabel: { color: colors.muted, fontSize: 8, lineHeight: 11 },
  chart: {
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sectionKicker: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.3 },
  sectionTitle: { color: colors.cream, fontSize: 17, fontWeight: '700', marginTop: 4 },
  bars: { gap: 15 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 67, color: colors.muted, fontSize: 10 },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.inkSoft, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4 },
  barValue: { width: 16, textAlign: 'right', color: colors.cream, fontSize: 10, fontWeight: '700' },
  quote: {
    borderRadius: radius.lg,
    padding: 21,
    backgroundColor: `${colors.lavender}0D`,
    borderWidth: 1,
    borderColor: `${colors.lavender}28`,
  },
  quoteMark: { color: colors.lavender, fontSize: 35, height: 30, fontWeight: '800' },
  quoteText: { color: colors.cream, fontSize: 15, lineHeight: 23, fontStyle: 'italic' },
  quoteAuthor: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.4, marginTop: 14 },
});

