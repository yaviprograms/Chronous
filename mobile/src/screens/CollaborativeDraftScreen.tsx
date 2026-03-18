import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useCapsules } from '../store/CapsuleContext';
import { colors, radius, spacing } from '../theme';
import { Capsule } from '../types';
import { formatLongDate } from '../utils/time';

export function CollaborativeDraftScreen({ capsule, onBack }: { capsule: Capsule; onBack: () => void }) {
  const { openCapsule, addContribution, sealDraft } = useCapsules();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(capsule.contentLoaded !== true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const openCapsuleRef = useRef(openCapsule);
  const refreshInFlight = useRef(false);

  useEffect(() => {
    openCapsuleRef.current = openCapsule;
  }, [openCapsule]);

  useEffect(() => {
    let active = true;

    async function refresh(reportError: boolean) {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      try {
        await openCapsuleRef.current(capsule.id);
      } catch (error) {
        if (active && reportError) {
          setMessage(error instanceof Error ? error.message : 'Could not refresh this draft.');
        }
      } finally {
        refreshInFlight.current = false;
        if (active) setLoading(false);
      }
    }

    void refresh(true);
    const timer = setInterval(() => void refresh(false), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [capsule.id]);

  async function refreshManually() {
    if (refreshInFlight.current) return;
    setRefreshing(true);
    setMessage('');
    refreshInFlight.current = true;
    try {
      await openCapsuleRef.current(capsule.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not refresh this draft.');
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }

  async function contribute() {
    const body = note.trim();
    if (!body) return;
    setBusy(true);
    setMessage('');
    try {
      await addContribution(capsule.id, body);
      setNote('');
      setMessage('Your contribution was added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add your contribution.');
    } finally {
      setBusy(false);
    }
  }

  async function seal() {
    setBusy(true);
    setMessage('');
    try {
      await sealDraft(capsule.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not seal this capsule.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshManually()}
              tintColor={colors.lavender}
              colors={[colors.lavender]}
            />
          }
        >
          <View style={styles.topBar}>
            <Pressable onPress={onBack} style={styles.iconButton} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={20} color={colors.cream} />
            </Pressable>
            <Text style={styles.topTitle}>SHARED DRAFT</Text>
            <Pressable
              onPress={() => void refreshManually()}
              style={styles.iconButton}
              accessibilityLabel="Refresh contributions"
            >
              <Ionicons name="refresh" size={19} color={colors.cream} />
            </Pressable>
          </View>

          <View style={[styles.hero, { borderColor: `${capsule.accent}55` }]}>
            <View style={[styles.heroIcon, { backgroundColor: `${capsule.accent}20` }]}>
              <Ionicons name="people" size={24} color={capsule.accent} />
            </View>
            <Text style={styles.eyebrow}>BUILDING TOGETHER</Text>
            <Text style={styles.title}>{capsule.title}</Text>
            <Text style={styles.subtitle}>{capsule.subtitle}</Text>
            <Text style={styles.unlock}>Seals for {formatLongDate(capsule.unlockAt)}</Text>
          </View>

          {loading ? <ActivityIndicator color={colors.lavender} /> : null}

          {capsule.letter || capsule.goals.length || capsule.predictions.length || capsule.photos.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>STARTING CONTENT</Text>
              {capsule.letter ? <Text style={styles.initialText}>{capsule.letter}</Text> : null}
              {capsule.goals.map((goal) => (
                <Text key={goal.id} style={styles.listText}>• {goal.text}</Text>
              ))}
              {capsule.predictions.map((prediction, index) => (
                <Text key={`${prediction}-${index}`} style={styles.listText}>• {prediction}</Text>
              ))}
              {capsule.photos.length ? (
                <Text style={styles.listText}>{capsule.photos.length} photo memories included</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CONTRIBUTIONS</Text>
            {(capsule.contributions ?? []).length ? (
              capsule.contributions!.map((contribution) => (
                <View key={contribution.id} style={styles.contribution}>
                  <View style={styles.contributorAvatar}>
                    <Text style={styles.contributorInitial}>
                      {(contribution.contributor?.displayName ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contributionCopy}>
                    <Text style={styles.contributorName}>
                      {contribution.contributor?.displayName ?? 'Collaborator'}
                    </Text>
                    <Text style={styles.contributionText}>{contribution.body}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No friend contributions yet. Add the first one.</Text>
            )}
          </View>

          <View style={styles.composer}>
            <Text style={styles.sectionLabel}>ADD YOUR PART</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Write a memory, message, or moment for everyone..."
              placeholderTextColor={colors.muted}
              selectionColor={capsule.accent}
              multiline
              maxLength={5000}
              style={styles.input}
            />
            <Button
              label="Add contribution"
              icon="add-circle-outline"
              loading={busy}
              disabled={!note.trim()}
              onPress={() => void contribute()}
            />
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {capsule.isOwner ? (
            <View style={styles.ownerCard}>
              <Ionicons name="shield-checkmark-outline" size={21} color={colors.mint} />
              <View style={styles.ownerCopy}>
                <Text style={styles.ownerTitle}>You control the seal</Text>
                <Text style={styles.ownerText}>Once sealed, nobody can add or read content until the unlock date.</Text>
              </View>
              <Button label="Seal" variant="secondary" loading={busy} onPress={() => void seal()} />
            </View>
          ) : (
            <Text style={styles.waiting}>The creator will seal this capsule when everyone is ready.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.mint, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  hero: { alignItems: 'center', gap: 8, padding: 24, borderRadius: radius.xl, borderWidth: 1, backgroundColor: colors.panel },
  heroIcon: { width: 52, height: 52, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.cream, fontSize: 27, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  unlock: { color: colors.lavender, fontSize: 10, fontWeight: '700', marginTop: 4 },
  section: { padding: 16, gap: 11, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  sectionLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  initialText: { color: colors.cream, fontSize: 14, lineHeight: 22 },
  listText: { color: colors.cream, fontSize: 12, lineHeight: 18 },
  empty: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  contribution: { flexDirection: 'row', gap: 11, paddingTop: 4 },
  contributorAvatar: { width: 34, height: 34, borderRadius: 13, backgroundColor: colors.lavenderDeep, alignItems: 'center', justifyContent: 'center' },
  contributorInitial: { color: colors.white, fontSize: 12, fontWeight: '900' },
  contributionCopy: { flex: 1, gap: 3 },
  contributorName: { color: colors.lavender, fontSize: 10, fontWeight: '800' },
  contributionText: { color: colors.cream, fontSize: 13, lineHeight: 19 },
  composer: { gap: 11 },
  input: { minHeight: 116, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, color: colors.cream, fontSize: 13, lineHeight: 20, textAlignVertical: 'top' },
  message: { color: colors.mint, fontSize: 11, textAlign: 'center' },
  ownerCard: { gap: 12, padding: 15, borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.mint}35`, backgroundColor: `${colors.mint}0B` },
  ownerCopy: { gap: 3 },
  ownerTitle: { color: colors.mint, fontSize: 12, fontWeight: '800' },
  ownerText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  waiting: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 17 },
});
