import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { colors, radius, shadow, spacing } from '../theme';

type LandingScreenProps = {
  onSignIn: () => void;
  onSignUp: () => void;
};

const promises = [
  { icon: 'lock-closed-outline' as const, label: 'Private until the moment arrives' },
  { icon: 'people-outline' as const, label: 'Make memories with your people' },
  { icon: 'cloud-done-outline' as const, label: 'Safe across every device' },
];

export function LandingScreen({ onSignIn, onSignUp }: LandingScreenProps) {
  return (
    <LinearGradient colors={['#09111F', '#111A33', '#09111F']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topbar}>
            <View style={styles.brandMark}>
              <Ionicons name="hourglass-outline" size={19} color={colors.ink} />
            </View>
            <Text style={styles.brand}>CHRONOUS</Text>
            <Pressable accessibilityRole="button" onPress={onSignIn} hitSlop={12}>
              <Text style={styles.signInLink}>Sign in</Text>
            </Pressable>
          </View>

          <View style={styles.artwork}>
            <View style={styles.orbitOuter} />
            <View style={styles.orbitInner} />
            <View style={[styles.memory, styles.memoryLeft]}>
              <Text style={styles.memoryEmoji}>✦</Text>
            </View>
            <View style={[styles.memory, styles.memoryRight]}>
              <Ionicons name="people" size={22} color={colors.ink} />
            </View>
            <LinearGradient colors={[colors.lavender, '#7C68EB']} style={styles.capsule}>
              <Ionicons name="lock-closed" size={30} color={colors.white} />
              <View style={styles.capsuleLine} />
              <Text style={styles.capsuleDate}>2030</Text>
            </LinearGradient>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>MEMORIES THAT WAIT FOR YOU</Text>
            <Text style={styles.title}>Send something meaningful into the future.</Text>
            <Text style={styles.subtitle}>
              Write to your future self, preserve a season, or seal a moment with friends—then
              open it together when the time is right.
            </Text>
          </View>

          <View style={styles.promiseList}>
            {promises.map((promise) => (
              <View key={promise.label} style={styles.promise}>
                <View style={styles.promiseIcon}>
                  <Ionicons name={promise.icon} size={17} color={colors.mint} />
                </View>
                <Text style={styles.promiseText}>{promise.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              label="Create your account"
              icon="arrow-forward"
              onPress={onSignUp}
            />
            <Button
              label="I already have an account"
              variant="secondary"
              onPress={onSignIn}
            />
          </View>

          <Text style={styles.terms}>Your capsules stay private and are protected by account-level access.</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  topbar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: colors.cream, fontSize: 13, fontWeight: '900', letterSpacing: 2.4, flex: 1 },
  signInLink: { color: colors.lavender, fontSize: 15, fontWeight: '800' },
  artwork: { height: 250, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  orbitOuter: {
    position: 'absolute',
    width: 236,
    height: 236,
    borderRadius: 118,
    borderWidth: 1,
    borderColor: `${colors.lavender}25`,
  },
  orbitInner: {
    position: 'absolute',
    width: 174,
    height: 174,
    borderRadius: 87,
    borderWidth: 1,
    borderColor: `${colors.mint}20`,
  },
  capsule: {
    width: 102,
    height: 146,
    borderRadius: 51,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...shadow,
  },
  capsuleLine: { width: 48, height: 1, backgroundColor: `${colors.white}55` },
  capsuleDate: { color: colors.white, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  memory: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  memoryLeft: { left: '14%', top: 56, backgroundColor: colors.peach, transform: [{ rotate: '-10deg' }] },
  memoryRight: { right: '12%', bottom: 44, backgroundColor: colors.mint, transform: [{ rotate: '8deg' }] },
  memoryEmoji: { fontSize: 22, color: colors.ink },
  hero: { alignItems: 'center' },
  eyebrow: { color: colors.mint, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  title: {
    color: colors.cream,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  promiseList: { marginTop: spacing.xl, gap: 10 },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: `${colors.panel}B8`,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
  },
  promiseIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: `${colors.mint}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promiseText: { color: colors.cream, fontSize: 14, fontWeight: '600', flex: 1 },
  actions: { marginTop: spacing.xl, gap: 11 },
  terms: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: spacing.md, lineHeight: 17 },
});
