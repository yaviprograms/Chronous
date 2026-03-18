import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Countdown } from '../components/Countdown';
import { countsForCapsule, mediaAuthorizationHeader } from '../api/capsules';
import { useCapsules } from '../store/CapsuleContext';
import { Capsule } from '../types';
import { colors, radius, spacing } from '../theme';
import { formatLongDate, getCountdown } from '../utils/time';

export function CapsuleDetailScreen({
  capsule,
  onBack,
}: {
  capsule: Capsule;
  onBack: () => void;
}) {
  const { openCapsule, toggleGoal, session } = useCapsules();
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState('');
  const canOpen = getCountdown(capsule.unlockAt).isUnlocked;
  const isOpen = capsule.status === 'opened' && capsule.contentLoaded !== false;
  const counts = countsForCapsule(capsule);

  async function reveal() {
    setRevealBusy(true);
    setRevealError('');
    try {
      await openCapsule(capsule.id);
    } catch (error) {
      setRevealError(error instanceof Error ? error.message : 'The capsule could not be opened.');
    } finally {
      setRevealBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} accessibilityLabel="Go back" style={styles.iconButton}>
            <Ionicons name="arrow-back" size={20} color={colors.cream} />
          </Pressable>
          <Text style={styles.topTitle}>{isOpen ? 'OPEN CAPSULE' : 'SEALED CAPSULE'}</Text>
          <Pressable accessibilityLabel="More options" style={styles.iconButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.cream} />
          </Pressable>
        </View>

        <LinearGradient
          colors={[capsule.accent, '#493D80', colors.inkSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.orbitLarge} />
          <View style={styles.orbitSmall} />
          <View style={styles.heroBadge}>
            <Ionicons
              name={isOpen || canOpen ? 'lock-open-outline' : 'lock-closed-outline'}
              size={13}
              color={colors.cream}
            />
            <Text style={styles.heroBadgeText}>{isOpen ? 'OPENED' : canOpen ? 'READY' : 'IN TRANSIT'}</Text>
          </View>
          <Text style={styles.heroEmoji}>{capsule.emoji}</Text>
          <View>
            <Text style={styles.heroRecipient}>TO {capsule.recipient.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{capsule.title}</Text>
            <Text style={styles.heroSubtitle}>{capsule.subtitle}</Text>
          </View>
        </LinearGradient>

        {!isOpen ? (
          <>
            <View style={styles.countdownCard}>
              <Text style={styles.sectionKicker}>{canOpen ? 'YOUR MOMENT HAS ARRIVED' : 'TIME REMAINING'}</Text>
              <Countdown unlockAt={capsule.unlockAt} accent={capsule.accent} />
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                <Text style={styles.dateText}>Unlocks {formatLongDate(capsule.unlockAt)}</Text>
              </View>
            </View>

            <View style={styles.manifest}>
              <View style={styles.manifestHeader}>
                <Text style={styles.manifestTitle}>Inside this capsule</Text>
                <Ionicons name="eye-off-outline" size={17} color={colors.muted} />
              </View>
              <ManifestRow
                icon="mail-outline"
                label={capsule.collaborative ? 'Messages together' : 'Personal letter'}
                value={counts.letter ? `${counts.letter} sealed` : 'None'}
                accent={capsule.accent}
              />
              <ManifestRow
                icon="flag-outline"
                label="Goals & promises"
                value={`${counts.goals} sealed`}
                accent={capsule.accent}
              />
              <ManifestRow
                icon="images-outline"
                label="Photo memories"
                value={`${counts.photos} sealed`}
                accent={capsule.accent}
              />
              <ManifestRow
                icon="telescope-outline"
                label="Predictions"
                value={`${counts.predictions} sealed`}
                accent={capsule.accent}
                last
              />
            </View>

            {canOpen ? (
              <>
                {revealError ? <Text style={styles.revealError}>{revealError}</Text> : null}
                <Button
                  label={capsule.status === 'opened' ? 'Restore cloud contents' : 'Open the capsule'}
                  icon="lock-open-outline"
                  loading={revealBusy}
                  onPress={() => void reveal()}
                />
              </>
            ) : (
              <View style={styles.lockNote}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.mint} />
                <View style={styles.lockNoteCopy}>
                  <Text style={styles.lockNoteTitle}>Protected by trusted time</Text>
                  <Text style={styles.lockNoteText}>
                    The contents stay private until the server verifies the unlock moment.
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.openedContent}>
            <View style={styles.openedBanner}>
              <View style={[styles.openedIcon, { backgroundColor: `${capsule.accent}20` }]}>
                <Ionicons name="sparkles" size={23} color={capsule.accent} />
              </View>
              <View style={styles.openedBannerCopy}>
                <Text style={styles.openedBannerTitle}>A message made it through time</Text>
                <Text style={styles.openedBannerText}>
                  Sealed {formatLongDate(capsule.createdAt)}
                </Text>
              </View>
            </View>

            {capsule.letter ? (
              <View style={styles.letter}>
                <Text style={[styles.letterQuote, { color: capsule.accent }]}>“</Text>
                <Text style={styles.letterText}>{capsule.letter}</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signature}>— You, from the past</Text>
              </View>
            ) : null}

            {(capsule.contributions ?? []).length ? (
              <ContentSection eyebrow="FROM EVERYONE" title="Built together">
                {capsule.contributions!.map((contribution) => (
                  <View key={contribution.id} style={styles.contribution}>
                    <View style={[styles.contributorAvatar, { backgroundColor: `${capsule.accent}25` }]}>
                      <Text style={[styles.contributorInitial, { color: capsule.accent }]}>
                        {(contribution.contributor?.displayName ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.contributionCopy}>
                      <Text style={[styles.contributorName, { color: capsule.accent }]}>
                        {contribution.contributor?.displayName ?? 'Collaborator'}
                      </Text>
                      <Text style={styles.contributionText}>{contribution.body}</Text>
                    </View>
                  </View>
                ))}
              </ContentSection>
            ) : null}

            {capsule.goals.length ? (
              <ContentSection
                eyebrow="PROMISES"
                title="How did you do?"
                count={`${capsule.goals.filter((goal) => goal.completed).length}/${capsule.goals.length}`}
              >
                {capsule.goals.map((goal) => (
                  <Pressable
                    key={goal.id}
                    onPress={() => void toggleGoal(capsule.id, goal.id)}
                    style={styles.goal}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        goal.completed && { backgroundColor: capsule.accent, borderColor: capsule.accent },
                      ]}
                    >
                      {goal.completed ? <Ionicons name="checkmark" size={14} color={colors.ink} /> : null}
                    </View>
                    <Text style={[styles.goalText, goal.completed && styles.goalDone]}>{goal.text}</Text>
                  </Pressable>
                ))}
              </ContentSection>
            ) : null}

            {capsule.predictions.length ? (
              <ContentSection eyebrow="PREDICTIONS" title="Did the future agree?">
                {capsule.predictions.map((prediction, index) => (
                  <View key={`${prediction}-${index}`} style={styles.prediction}>
                    <Text style={[styles.predictionNumber, { color: capsule.accent }]}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                    <Text style={styles.predictionText}>{prediction}</Text>
                  </View>
                ))}
              </ContentSection>
            ) : null}

            {capsule.photos.length ? (
              <ContentSection eyebrow="MEMORIES" title="The way it looked">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                  {capsule.photos.map((photo) => (
                    <Image
                      key={photo.id}
                      source={{
                        uri: photo.uri,
                        headers:
                          photo.requiresAuth && session
                            ? mediaAuthorizationHeader()
                            : undefined,
                      }}
                      style={styles.photo}
                    />
                  ))}
                </ScrollView>
              </ContentSection>
            ) : null}

            <View style={styles.reflection}>
              <Ionicons name="create-outline" size={21} color={colors.amber} />
              <View style={styles.reflectionCopy}>
                <Text style={styles.reflectionTitle}>Close the loop</Text>
                <Text style={styles.reflectionText}>
                  Create a new capsule about what changed since this one was sealed.
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.muted} />
            </View>
          </View>
        )}

        <View style={styles.audit}>
          <View style={styles.auditLine} />
          <Ionicons name="finger-print-outline" size={17} color={colors.muted} />
          <Text style={styles.auditText}>CAPSULE ID · {capsule.id.slice(-10).toUpperCase()}</Text>
          <View style={styles.auditLine} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ManifestRow({
  icon,
  label,
  value,
  accent,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.manifestRow, last && { borderBottomWidth: 0 }]}>
      <View style={[styles.manifestIcon, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={17} color={accent} />
      </View>
      <Text style={styles.manifestLabel}>{label}</Text>
      <Text style={styles.manifestValue}>{value}</Text>
    </View>
  );
}

function ContentSection({
  eyebrow,
  title,
  count,
  children,
}: {
  eyebrow: string;
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.contentSection}>
      <View style={styles.contentSectionHead}>
        <View>
          <Text style={styles.sectionKicker}>{eyebrow}</Text>
          <Text style={styles.contentTitle}>{title}</Text>
        </View>
        {count ? <Text style={styles.contentCount}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: 34, gap: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  topTitle: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  hero: {
    minHeight: 300,
    borderRadius: radius.xl,
    padding: 21,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  orbitLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.17)',
    right: -60,
    top: -55,
  },
  orbitSmall: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    right: -20,
    top: -15,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    borderRadius: radius.round,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'rgba(9,17,31,0.35)',
  },
  heroBadgeText: { color: colors.cream, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  heroEmoji: { position: 'absolute', right: 28, top: 83, color: colors.white, fontSize: 46 },
  heroRecipient: { color: 'rgba(255,255,255,0.66)', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: {
    color: colors.white,
    fontSize: 31,
    fontWeight: '700',
    lineHeight: 35,
    letterSpacing: -0.7,
    marginTop: 7,
    maxWidth: '88%',
  },
  heroSubtitle: { color: 'rgba(255,255,255,0.67)', fontSize: 12, marginTop: 7 },
  countdownCard: {
    padding: 19,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 15,
  },
  sectionKicker: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dateText: { color: colors.muted, fontSize: 10 },
  manifest: {
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 17,
  },
  manifestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  manifestTitle: { color: colors.cream, fontSize: 15, fontWeight: '700' },
  manifestRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  manifestIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manifestLabel: { flex: 1, color: colors.cream, fontSize: 11, fontWeight: '600' },
  manifestValue: { color: colors.muted, fontSize: 10 },
  lockNote: {
    padding: 15,
    flexDirection: 'row',
    gap: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.mint}30`,
    backgroundColor: `${colors.mint}0B`,
  },
  lockNoteCopy: { flex: 1, gap: 3 },
  lockNoteTitle: { color: colors.mint, fontSize: 11, fontWeight: '800' },
  lockNoteText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  revealError: { color: colors.peach, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  openedContent: { gap: spacing.lg },
  openedBanner: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    padding: 15,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  openedIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openedBannerCopy: { flex: 1, gap: 3 },
  openedBannerTitle: { color: colors.cream, fontSize: 13, fontWeight: '700' },
  openedBannerText: { color: colors.muted, fontSize: 10 },
  letter: {
    borderRadius: radius.lg,
    padding: 24,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  letterQuote: { position: 'absolute', right: 18, top: -12, fontSize: 80, opacity: 0.16, fontWeight: '800' },
  letterText: { color: colors.ink, fontSize: 16, lineHeight: 26, fontWeight: '500' },
  signatureLine: { width: 44, height: 2, backgroundColor: colors.ink, opacity: 0.2, marginTop: 22, marginBottom: 10 },
  signature: { color: '#596275', fontSize: 11, fontStyle: 'italic' },
  contentSection: {
    borderRadius: radius.lg,
    padding: 17,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 11,
  },
  contentSectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  contentTitle: { color: colors.cream, fontSize: 16, fontWeight: '700', marginTop: 4 },
  contentCount: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  contribution: { flexDirection: 'row', gap: 11, paddingTop: 7 },
  contributorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contributorInitial: { fontSize: 12, fontWeight: '900' },
  contributionCopy: { flex: 1, gap: 3 },
  contributorName: { fontSize: 10, fontWeight: '800' },
  contributionText: { color: colors.cream, fontSize: 13, lineHeight: 19 },
  goal: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalText: { flex: 1, color: colors.cream, fontSize: 11, lineHeight: 16 },
  goalDone: { color: colors.muted, textDecorationLine: 'line-through' },
  prediction: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  predictionNumber: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  predictionText: { flex: 1, color: colors.cream, fontSize: 12, lineHeight: 18 },
  photos: { gap: 10 },
  photo: { width: 210, height: 250, borderRadius: radius.md, backgroundColor: colors.inkSoft },
  reflection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderRadius: radius.lg,
    backgroundColor: `${colors.amber}0D`,
    borderWidth: 1,
    borderColor: `${colors.amber}2A`,
  },
  reflectionCopy: { flex: 1, gap: 3 },
  reflectionTitle: { color: colors.cream, fontSize: 12, fontWeight: '700' },
  reflectionText: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  audit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  auditLine: { flex: 1, height: 1, backgroundColor: colors.line },
  auditText: { color: colors.muted, fontSize: 7, fontWeight: '700', letterSpacing: 1 },
});
