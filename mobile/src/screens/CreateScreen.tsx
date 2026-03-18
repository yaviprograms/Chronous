import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { ComponentProps, useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Friendship, listFriends } from '../api/friends';
import { Button } from '../components/Button';
import { useCapsules } from '../store/CapsuleContext';
import { Capsule, CapsulePhoto, CapsuleType, GoalItem, NewCapsule } from '../types';
import { colors, radius, spacing } from '../theme';
import { dateFromDays, formatLongDate, parseDateInput } from '../utils/time';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TYPE_OPTIONS: {
  type: CapsuleType;
  title: string;
  description: string;
  icon: IconName;
  emoji: string;
  accent: string;
}[] = [
  {
    type: 'letter',
    title: 'Future letter',
    description: 'Write what only time can answer',
    icon: 'mail-outline',
    emoji: '✦',
    accent: colors.lavender,
  },
  {
    type: 'goals',
    title: 'Goal pact',
    description: 'Set promises, then look back',
    icon: 'flag-outline',
    emoji: '◎',
    accent: colors.mint,
  },
  {
    type: 'memories',
    title: 'Memory box',
    description: 'Preserve photos and a feeling',
    icon: 'images-outline',
    emoji: '☀',
    accent: colors.peach,
  },
  {
    type: 'predictions',
    title: 'Predictions',
    description: 'Make your best future guesses',
    icon: 'telescope-outline',
    emoji: '◌',
    accent: colors.sky,
  },
];

const DATE_PRESETS = [
  { label: '1 month', days: 30 },
  { label: '6 months', days: 183 },
  { label: '1 year', days: 365 },
  { label: '5 years', days: 1826 },
];

function makeItemId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function CreateScreen({ onCreated }: { onCreated: (capsule: Capsule) => void }) {
  const { addCapsule, session } = useCapsules();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<CapsuleType>('letter');
  const [title, setTitle] = useState('');
  const [letter, setLetter] = useState('');
  const [recipient, setRecipient] = useState('Future me');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [predictions, setPredictions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<CapsulePhoto[]>([]);
  const [newListItem, setNewListItem] = useState('');
  const [unlockAt, setUnlockAt] = useState(dateFromDays(365));
  const [dateInput, setDateInput] = useState('');
  const [dateError, setDateError] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [shareWithFriends, setShareWithFriends] = useState(false);
  const [buildTogether, setBuildTogether] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friendsError, setFriendsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const selectedType = TYPE_OPTIONS.find((item) => item.type === type) ?? TYPE_OPTIONS[0]!;
  const contentCount = goals.length + predictions.length + photos.length + (letter.trim() ? 1 : 0);
  const acceptedFriends = useMemo(
    () => friendships.filter((item) => item.status === 'accepted'),
    [friendships],
  );
  const sharedWithUsernames = useMemo(
    () =>
      acceptedFriends
        .filter((item) => selectedFriendIds.includes(item.profile.id))
        .map((item) => item.profile.username),
    [acceptedFriends, selectedFriendIds],
  );
  const canContinue =
    step === 0
      ? Boolean(type)
      : step === 1
        ? title.trim().length >= 3 && contentCount > 0
        : !shareWithFriends || (Boolean(session) && sharedWithUsernames.length > 0);

  useEffect(() => {
    if (!session) return;
    listFriends()
      .then(setFriendships)
      .catch((error) =>
        setFriendsError(error instanceof Error ? error.message : 'Could not load your friends.'),
      );
  }, [session]);

  const subtitle = useMemo(() => {
    const pieces = [];
    if (letter.trim()) pieces.push('a letter');
    if (goals.length) pieces.push(`${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`);
    if (photos.length) pieces.push(`${photos.length} ${photos.length === 1 ? 'memory' : 'memories'}`);
    if (predictions.length)
      pieces.push(`${predictions.length} ${predictions.length === 1 ? 'prediction' : 'predictions'}`);
    return pieces.join(', ') || selectedType.description;
  }, [goals.length, letter, photos.length, predictions.length, selectedType.description]);

  function addListItem() {
    const value = newListItem.trim();
    if (!value) return;
    if (type === 'goals') {
      setGoals((current) => [...current, { id: makeItemId('goal'), text: value, completed: false }]);
    } else {
      setPredictions((current) => [...current, value]);
    }
    setNewListItem('');
  }

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 8,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos((current) => [
        ...current,
        ...result.assets.map((asset) => ({
          id: makeItemId('photo'),
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        })),
      ]);
    }
  }

  function applyCustomDate() {
    const parsed = parseDateInput(dateInput);
    if (!parsed) {
      setDateError('Use YYYY-MM-DD and choose a future date.');
      return;
    }
    setUnlockAt(parsed);
    setDateError('');
  }

  async function sealCapsule() {
    if (!selectedType) return;
    setSaving(true);
    setSaveError('');
    const input: NewCapsule = {
      title: title.trim(),
      subtitle,
      type,
      recipient: recipient.trim() || 'Future me',
      letter: letter.trim(),
      goals,
      predictions,
      photos,
      unlockAt,
      accent: selectedType.accent,
      emoji: selectedType.emoji,
      reminderEnabled,
      sharedWithUsernames: shareWithFriends ? sharedWithUsernames : [],
      collaborative: shareWithFriends && buildTogether,
    };
    try {
      const capsule = await addCapsule(input);
      setStep(0);
      setTitle('');
      setLetter('');
      setGoals([]);
      setPredictions([]);
      setPhotos([]);
      setDateInput('');
      setShareWithFriends(false);
      setBuildTogether(false);
      setSelectedFriendIds([]);
      onCreated(capsule);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'This capsule could not be sealed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            {step > 0 ? (
              <Pressable style={styles.back} onPress={() => setStep((value) => value - 1)}>
                <Ionicons name="arrow-back" size={20} color={colors.cream} />
              </Pressable>
            ) : (
              <View style={styles.headerIcon}>
                <Ionicons name="add" size={21} color={colors.ink} />
              </View>
            )}
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>NEW CAPSULE · {step + 1} OF 3</Text>
              <Text style={styles.title}>
                {step === 0 ? 'What are we preserving?' : step === 1 ? 'Fill it with meaning' : 'Send it through time'}
              </Text>
            </View>
          </View>

          <View style={styles.progress}>
            {[0, 1, 2].map((item) => (
              <View
                key={item}
                style={[
                  styles.progressSegment,
                  item <= step && { backgroundColor: selectedType.accent },
                ]}
              />
            ))}
          </View>

          {step === 0 ? (
            <View style={styles.typeGrid}>
              {TYPE_OPTIONS.map((option) => {
                const active = type === option.type;
                return (
                  <Pressable
                    key={option.type}
                    onPress={() => setType(option.type)}
                    style={[
                      styles.typeCard,
                      active && { borderColor: option.accent, backgroundColor: `${option.accent}12` },
                    ]}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: `${option.accent}20` }]}>
                      <Ionicons name={option.icon} size={25} color={option.accent} />
                    </View>
                    <View style={styles.typeCopy}>
                      <Text style={styles.typeTitle}>{option.title}</Text>
                      <Text style={styles.typeDescription}>{option.description}</Text>
                    </View>
                    <View style={[styles.radio, active && { borderColor: option.accent }]}>
                      {active ? <View style={[styles.radioDot, { backgroundColor: option.accent }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
              <View style={styles.idea}>
                <Ionicons name="bulb-outline" size={18} color={colors.amber} />
                <Text style={styles.ideaText}>
                  You can mix formats. Add a letter to goals, photos to predictions, or all three.
                </Text>
              </View>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.form}>
              <FieldLabel label="Capsule title" hint={`${title.length}/60`} />
              <TextInput
                value={title}
                onChangeText={(value) => setTitle(value.slice(0, 60))}
                placeholder="Give this moment a name"
                placeholderTextColor={colors.muted}
                style={styles.input}
                selectionColor={selectedType.accent}
              />

              <FieldLabel
                label={type === 'memories' ? 'The story behind it' : 'A note for the future'}
                hint="optional"
              />
              <TextInput
                value={letter}
                onChangeText={setLetter}
                placeholder={
                  type === 'letter'
                    ? 'Dear future me...'
                    : 'What do you want to remember about this moment?'
                }
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textarea]}
                multiline
                textAlignVertical="top"
                selectionColor={selectedType.accent}
              />

              {type === 'goals' || type === 'predictions' ? (
                <>
                  <FieldLabel label={type === 'goals' ? 'Promises to keep' : 'Your predictions'} />
                  <View style={styles.addRow}>
                    <TextInput
                      value={newListItem}
                      onChangeText={setNewListItem}
                      onSubmitEditing={addListItem}
                      placeholder={type === 'goals' ? 'I will...' : 'I think...'}
                      placeholderTextColor={colors.muted}
                      style={[styles.input, styles.addInput]}
                      selectionColor={selectedType.accent}
                    />
                    <Pressable
                      onPress={addListItem}
                      style={[styles.addButton, { backgroundColor: selectedType.accent }]}
                    >
                      <Ionicons name="add" size={23} color={colors.ink} />
                    </Pressable>
                  </View>
                  <View style={styles.itemList}>
                    {(type === 'goals' ? goals : predictions).map((item, index) => {
                      const text = typeof item === 'string' ? item : item.text;
                      return (
                        <View key={typeof item === 'string' ? `${item}-${index}` : item.id} style={styles.listItem}>
                          <Text style={[styles.itemNumber, { color: selectedType.accent }]}>
                            {String(index + 1).padStart(2, '0')}
                          </Text>
                          <Text style={styles.itemText}>{text}</Text>
                          <Pressable
                            onPress={() =>
                              type === 'goals'
                                ? setGoals((current) => current.filter((goal) => goal.id !== (item as GoalItem).id))
                                : setPredictions((current) => current.filter((_, itemIndex) => itemIndex !== index))
                            }
                          >
                            <Ionicons name="close" size={17} color={colors.muted} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <FieldLabel label="Photos & keepsakes" hint={`${photos.length}/8`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                <Pressable onPress={() => void pickPhotos()} style={styles.photoAdd}>
                  <Ionicons name="image-outline" size={23} color={selectedType.accent} />
                  <Text style={styles.photoAddText}>Add</Text>
                </Pressable>
                {photos.map((photo) => (
                  <View key={photo.id}>
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                    <Pressable
                      style={styles.removePhoto}
                      onPress={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}
                    >
                      <Ionicons name="close" size={13} color={colors.cream} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              {contentCount === 0 ? (
                <Text style={styles.validation}>Add a note, list item, or photo to continue.</Text>
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.form}>
              <View style={[styles.dateHero, { borderColor: `${selectedType.accent}55` }]}>
                <View style={[styles.dateIcon, { backgroundColor: `${selectedType.accent}20` }]}>
                  <Ionicons name="hourglass-outline" size={25} color={selectedType.accent} />
                </View>
                <Text style={styles.dateKicker}>CURRENT UNLOCK DATE</Text>
                <Text style={styles.dateValue}>{formatLongDate(unlockAt)}</Text>
                <Text style={styles.dateNote}>at 9:00 AM · your local timezone</Text>
              </View>

              <FieldLabel label="Choose a horizon" />
              <View style={styles.presetGrid}>
                {DATE_PRESETS.map((preset) => {
                  const value = dateFromDays(preset.days);
                  const active =
                    Math.abs(new Date(value).getTime() - new Date(unlockAt).getTime()) < 86_400_000;
                  return (
                    <Pressable
                      key={preset.days}
                      onPress={() => {
                        setUnlockAt(value);
                        setDateError('');
                      }}
                      style={[
                        styles.preset,
                        active && { backgroundColor: `${selectedType.accent}18`, borderColor: selectedType.accent },
                      ]}
                    >
                      <Text style={[styles.presetText, active && { color: selectedType.accent }]}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <FieldLabel label="Or pick an exact date" hint="YYYY-MM-DD" />
              <View style={styles.addRow}>
                <TextInput
                  value={dateInput}
                  onChangeText={setDateInput}
                  onSubmitEditing={applyCustomDate}
                  placeholder="2028-07-31"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.addInput]}
                  keyboardType="numbers-and-punctuation"
                  selectionColor={selectedType.accent}
                />
                <Pressable
                  onPress={applyCustomDate}
                  style={[styles.dateApply, { borderColor: selectedType.accent }]}
                >
                  <Text style={[styles.dateApplyText, { color: selectedType.accent }]}>Set</Text>
                </Pressable>
              </View>
              {dateError ? <Text style={styles.validation}>{dateError}</Text> : null}

              <FieldLabel label="Who is it for?" />
              <View style={styles.inputWithIcon}>
                <Ionicons name="person-outline" size={18} color={colors.muted} />
                <TextInput
                  value={recipient}
                  onChangeText={setRecipient}
                  placeholder="Future me"
                  placeholderTextColor={colors.muted}
                  style={styles.inlineInput}
                  selectionColor={selectedType.accent}
                />
              </View>

              <View style={styles.setting}>
                <View style={[styles.settingIcon, { backgroundColor: `${colors.lavender}18` }]}>
                  <Ionicons name="people-outline" size={19} color={colors.lavender} />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>Create with friends</Text>
                  <Text style={styles.settingText}>Choose accepted friends to include in this capsule</Text>
                </View>
                <Switch
                  value={shareWithFriends}
                  onValueChange={(enabled) => {
                    setShareWithFriends(enabled);
                    if (!enabled) setBuildTogether(false);
                  }}
                  disabled={!session}
                  trackColor={{ false: colors.line, true: colors.lavender }}
                  thumbColor={colors.cream}
                />
              </View>

              <View style={[styles.setting, !session && styles.settingDisabled]}>
                <View style={[styles.settingIcon, { backgroundColor: `${colors.mint}18` }]}>
                  <Ionicons name="create-outline" size={19} color={colors.mint} />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>Build it together</Text>
                  <Text style={styles.settingText}>
                    Start a shared draft where every selected friend can contribute before you seal it
                  </Text>
                </View>
                <Switch
                  value={buildTogether}
                  onValueChange={(enabled) => {
                    setBuildTogether(enabled);
                    if (enabled) setShareWithFriends(true);
                  }}
                  disabled={!session}
                  trackColor={{ false: colors.line, true: colors.mint }}
                  thumbColor={colors.cream}
                />
              </View>

              {shareWithFriends ? (
                <View style={styles.friendShare}>
                  <FieldLabel label="Choose friends" hint={`${selectedFriendIds.length} selected`} />
                  {acceptedFriends.length ? (
                    <View style={styles.friendChoices}>
                      {acceptedFriends.map((item) => {
                        const selected = selectedFriendIds.includes(item.profile.id);
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() =>
                              setSelectedFriendIds((current) =>
                                selected
                                  ? current.filter((id) => id !== item.profile.id)
                                  : [...current, item.profile.id],
                              )
                            }
                            style={[styles.friendChoice, selected && styles.friendChoiceSelected]}
                          >
                            <View style={[styles.friendCheck, selected && styles.friendCheckSelected]}>
                              {selected ? <Ionicons name="checkmark" size={13} color={colors.ink} /> : null}
                            </View>
                            <View style={styles.friendChoiceCopy}>
                              <Text style={styles.friendChoiceName}>{item.profile.displayName}</Text>
                              <Text style={styles.friendChoiceHandle}>@{item.profile.username}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.friendHint}>
                      {friendsError || 'Add and accept friends from your Profile before sharing a capsule.'}
                    </Text>
                  )}
                  <Text style={styles.friendHint}>
                    {buildTogether
                      ? 'Selected friends can add notes while the draft is open. Only you can seal it.'
                      : 'Selected friends will see the capsule in their vault, but its contents stay sealed until the unlock date.'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.setting}>
                <View style={[styles.settingIcon, { backgroundColor: `${colors.amber}18` }]}>
                  <Ionicons name="notifications-outline" size={19} color={colors.amber} />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>Unlock reminder</Text>
                  <Text style={styles.settingText}>Notify me on the day this capsule opens</Text>
                </View>
                <Switch
                  value={reminderEnabled}
                  onValueChange={setReminderEnabled}
                  trackColor={{ false: colors.line, true: selectedType.accent }}
                  thumbColor={colors.cream}
                />
              </View>

              <View style={styles.security}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.mint} />
                <View style={styles.securityCopy}>
                  <Text style={styles.securityTitle}>Sealed means sealed</Text>
                  <Text style={styles.securityText}>
                    Production capsules use database policies and trusted server time. Their contents cannot be
                    queried before this date.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <Button
            label={
              step < 2
                ? 'Continue'
                : shareWithFriends && buildTogether
                  ? 'Start shared draft'
                  : 'Seal this capsule'
            }
            icon={step < 2 ? 'arrow-forward' : shareWithFriends && buildTogether ? 'people' : 'lock-closed'}
            onPress={() => (step < 2 ? setStep((value) => value + 1) : void sealCapsule())}
            disabled={!canContinue}
            loading={saving}
            style={styles.cta}
          />
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.fieldLabel}>
      <Text style={styles.fieldLabelText}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: 116 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.lavender, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.cream, fontSize: 25, fontWeight: '700', letterSpacing: -0.6, marginTop: 4 },
  progress: { flexDirection: 'row', gap: 7, marginTop: 21, marginBottom: 24 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line },
  typeGrid: { gap: 11 },
  typeCard: {
    minHeight: 92,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 14,
  },
  typeIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCopy: { flex: 1, gap: 4 },
  typeTitle: { color: colors.cream, fontSize: 15, fontWeight: '700' },
  typeDescription: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  idea: {
    marginTop: 5,
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: `${colors.amber}0D`,
  },
  ideaText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  form: { gap: 13 },
  fieldLabel: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  fieldLabelText: { color: colors.cream, fontSize: 12, fontWeight: '700' },
  fieldHint: { color: colors.muted, fontSize: 10 },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.cream,
    paddingHorizontal: 15,
    fontSize: 13,
  },
  textarea: { minHeight: 150, paddingTop: 15, lineHeight: 20 },
  addRow: { flexDirection: 'row', gap: 9 },
  addInput: { flex: 1 },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemList: { gap: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  itemNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  itemText: { color: colors.cream, fontSize: 12, flex: 1, lineHeight: 17 },
  photoRow: { gap: 10, paddingVertical: 2 },
  photoAdd: {
    width: 86,
    height: 86,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  photo: { width: 86, height: 86, borderRadius: radius.md, backgroundColor: colors.panel },
  removePhoto: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,17,31,0.82)',
  },
  validation: { color: colors.danger, fontSize: 10, marginTop: -5 },
  dateHero: {
    padding: 22,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.panel,
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  dateIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  dateKicker: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.4 },
  dateValue: { color: colors.cream, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  dateNote: { color: colors.muted, fontSize: 10 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    width: '48%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingVertical: 13,
    alignItems: 'center',
  },
  presetText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  dateApply: {
    width: 60,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: colors.panel,
  },
  dateApplyText: { fontSize: 12, fontWeight: '800' },
  inputWithIcon: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
  },
  inlineInput: { flex: 1, color: colors.cream, fontSize: 13, paddingVertical: 12 },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  settingDisabled: { opacity: 0.55 },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { color: colors.cream, fontSize: 12, fontWeight: '700' },
  settingText: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  friendShare: { gap: 9, paddingBottom: 2 },
  friendHint: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  friendChoices: { gap: 8 },
  friendChoice: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  friendChoiceSelected: { borderColor: colors.lavender, backgroundColor: `${colors.lavender}0D` },
  friendCheck: { width: 22, height: 22, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  friendCheckSelected: { backgroundColor: colors.lavender, borderColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  friendChoiceCopy: { flex: 1, gap: 2 },
  friendChoiceName: { color: colors.cream, fontSize: 12, fontWeight: '700' },
  friendChoiceHandle: { color: colors.muted, fontSize: 9 },
  security: {
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: `${colors.mint}0D`,
    borderWidth: 1,
    borderColor: `${colors.mint}30`,
  },
  securityCopy: { flex: 1, gap: 3 },
  securityTitle: { color: colors.mint, fontSize: 11, fontWeight: '800' },
  securityText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  cta: { marginTop: 24 },
  saveError: { color: colors.danger, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10 },
});
