import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Capsule } from '../types';
import { colors, radius, shadow } from '../theme';
import { formatUnlockDate, getCountdown, relativeUnlockLabel } from '../utils/time';

type CapsuleCardProps = {
  capsule: Capsule;
  onPress: () => void;
  featured?: boolean;
};

const typeLabels = {
  letter: 'LETTER',
  goals: 'GOALS',
  memories: 'MEMORIES',
  predictions: 'PREDICTIONS',
};

export function CapsuleCard({ capsule, onPress, featured = false }: CapsuleCardProps) {
  const unlocked = getCountdown(capsule.unlockAt).isUnlocked || capsule.status === 'opened';
  const isDraft = capsule.status === 'draft';

  if (featured) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${capsule.title}`}
        style={({ pressed }) => [styles.featuredWrap, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={[capsule.accent, '#493D80', colors.inkSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featured}
        >
          <View style={styles.glowOne} />
          <View style={styles.glowTwo} />
          <View style={styles.featuredTop}>
            <View style={styles.typePill}>
              <Ionicons
                name={isDraft ? 'people-outline' : unlocked ? 'lock-open-outline' : 'lock-closed-outline'}
                size={12}
                color={colors.cream}
              />
              <Text style={styles.typePillText}>
                {isDraft ? 'BUILDING' : unlocked ? 'READY' : capsule.isShared ? 'SHARED' : typeLabels[capsule.type]}
              </Text>
            </View>
            <Text style={styles.featuredEmoji}>{capsule.emoji}</Text>
          </View>
          <View style={styles.featuredBottom}>
            <Text style={styles.featuredEyebrow}>
              {isDraft ? 'Shared draft open' : relativeUnlockLabel(capsule.unlockAt)}
            </Text>
            <Text style={styles.featuredTitle} numberOfLines={2}>
              {capsule.title}
            </Text>
            <Text style={styles.featuredSubtitle} numberOfLines={1}>
              {capsule.subtitle}
            </Text>
            <View style={styles.unlockRow}>
              <View style={styles.unlockLine} />
              <Text style={styles.unlockDate}>{formatUnlockDate(capsule.unlockAt)}</Text>
              <View style={styles.arrowButton}>
                <Ionicons name="arrow-forward" size={18} color={colors.ink} />
              </View>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${capsule.title}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconTile, { backgroundColor: `${capsule.accent}22` }]}>
        <Text style={[styles.emoji, { color: capsule.accent }]}>{capsule.emoji}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardType, { color: capsule.accent }]}> 
            {isDraft ? 'BUILDING' : unlocked ? 'OPEN' : capsule.isShared ? 'SHARED' : typeLabels[capsule.type]}
          </Text>
          <View style={styles.metaDot} />
          <Text style={styles.cardDate}>{formatUnlockDate(capsule.unlockAt)}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {capsule.title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {capsule.subtitle}
        </Text>
      </View>
      <View style={[styles.lockCircle, unlocked && { backgroundColor: `${capsule.accent}20` }]}>
        <Ionicons
          name={isDraft ? 'people-outline' : unlocked ? 'lock-open-outline' : 'lock-closed-outline'}
          size={17}
          color={unlocked ? capsule.accent : colors.muted}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  featuredWrap: {
    ...shadow,
  },
  featured: {
    height: 320,
    borderRadius: radius.xl,
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  glowOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.13)',
    top: -65,
    right: -35,
  },
  glowTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    top: -84,
    right: -50,
  },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typePill: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'rgba(9,17,31,0.34)',
    borderRadius: radius.round,
  },
  typePillText: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  featuredEmoji: {
    color: colors.cream,
    fontSize: 30,
  },
  featuredBottom: {
    gap: 7,
  },
  featuredEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  featuredTitle: {
    color: colors.white,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.7,
    maxWidth: '88%',
  },
  featuredSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 9,
  },
  unlockLine: {
    height: 1,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  unlockDate: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  card: {
    minHeight: 104,
    borderRadius: radius.lg,
    padding: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  iconTile: {
    height: 70,
    width: 62,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 25,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardType: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.muted,
  },
  cardDate: {
    color: colors.muted,
    fontSize: 10,
  },
  cardTitle: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 11,
  },
  lockCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inkSoft,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
});
