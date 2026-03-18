import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { requestPasswordRecovery } from '../api/session';
import { useCapsules } from '../store/CapsuleContext';
import { colors, radius, spacing } from '../theme';

export type AuthMode = 'signIn' | 'signUp';

type AuthScreenProps = {
  mode: AuthMode;
  onBack: () => void;
  onModeChange: (mode: AuthMode) => void;
};

export function AuthScreen({ mode, onBack, onModeChange }: AuthScreenProps) {
  const { signIn, signUp, apiError } = useCapsules();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<'password' | 'username' | null>(null);

  const isSignUp = mode === 'signUp';
  const isPasswordRecovery = !isSignUp && recoveryMode === 'password';
  const normalizedEmail = email.trim().toLowerCase();
  const validationError = useMemo(() => {
    if (isSignUp && displayName.trim().length < 2) return 'Enter the name your friends will recognize.';
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return 'Enter a valid email address.';
    if (isPasswordRecovery) return '';
    if (password.length < 8) return 'Use at least 8 characters for your password.';
    if (isSignUp && password !== confirmPassword) return 'Your passwords do not match.';
    return '';
  }, [confirmPassword, displayName, isPasswordRecovery, isSignUp, normalizedEmail, password]);

  useEffect(() => {
    setRecoveryMode(null);
    setMessage('');
  }, [mode]);

  async function submit() {
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (isSignUp) {
        const signedIn = await signUp(displayName.trim(), normalizedEmail, password);
        if (!signedIn) setConfirmationSent(true);
      } else {
        await signIn(normalizedEmail, password);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendRecovery() {
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await requestPasswordRecovery(normalizedEmail);
      setMessage(response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The recovery request could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  if (confirmationSent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.confirmation}>
          <View style={styles.confirmationIcon}>
            <Ionicons name="mail-unread-outline" size={32} color={colors.mint} />
          </View>
          <Text style={styles.confirmationTitle}>Check your inbox</Text>
          <Text style={styles.confirmationText}>
            We sent a confirmation link to {normalizedEmail}. Confirm your email, then come back and sign in.
          </Text>
          <Button
            label="Go to sign in"
            icon="arrow-forward"
            onPress={() => {
              setConfirmationSent(false);
              onModeChange('signIn');
            }}
          />
          <Button label="Back to welcome" variant="ghost" onPress={onBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
            <Ionicons name="arrow-back" size={21} color={colors.cream} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.eyebrow}>
              {isSignUp ? 'START YOUR STORY' : isPasswordRecovery ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}
            </Text>
            <Text style={styles.title}>
              {isSignUp
                ? 'Create your Chronous account'
                : isPasswordRecovery
                  ? 'Reset your password'
                  : 'Return to your future'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp
                ? 'One private place for every capsule you create alone or share with friends.'
                : isPasswordRecovery
                  ? 'Enter your account email and we will send a secure recovery link.'
                  : 'Sign in to sync your vault and see every capsule shared with you.'}
            </Text>
          </View>

          <View style={styles.form}>
            {isSignUp ? (
              <AuthField
                icon="person-outline"
                label="Your name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Alex Morgan"
                textContentType="name"
              />
            ) : null}
            <AuthField
              icon="mail-outline"
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCapitalize="none"
            />
            {!isPasswordRecovery ? (
              <AuthField
                icon="lock-closed-outline"
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                secureTextEntry={!showPassword}
                trailing={
                  <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={10}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                  </Pressable>
                }
              />
            ) : null}
            {isSignUp && !isPasswordRecovery ? (
              <AuthField
                icon="shield-checkmark-outline"
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat your password"
                textContentType="newPassword"
                secureTextEntry={!showPassword}
                onSubmitEditing={() => void submit()}
              />
            ) : null}

            {message || apiError ? (
              <Text style={isPasswordRecovery && message ? styles.success : styles.error}>
                {message || apiError}
              </Text>
            ) : null}

            <Button
              label={isSignUp ? 'Create account' : isPasswordRecovery ? 'Send recovery email' : 'Sign in'}
              icon={isSignUp ? 'person-add-outline' : isPasswordRecovery ? 'mail-outline' : 'arrow-forward'}
              onPress={() => void (isPasswordRecovery ? sendRecovery() : submit())}
              loading={busy}
            />

            {!isSignUp && !isPasswordRecovery ? (
              <View style={styles.recoveryLinks}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMessage('');
                    setRecoveryMode('password');
                  }}
                >
                  <Text style={styles.recoveryLink}>Forgot password?</Text>
                </Pressable>
                <View style={styles.recoveryDivider} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMessage('');
                    setRecoveryMode((current) => (current === 'username' ? null : 'username'));
                  }}
                >
                  <Text style={styles.recoveryLink}>Forgot username?</Text>
                </Pressable>
              </View>
            ) : null}

            {!isSignUp && recoveryMode === 'username' ? (
              <View style={styles.usernameHelp}>
                <Ionicons name="information-circle-outline" size={20} color={colors.mint} />
                <Text style={styles.usernameHelpText}>
                  You sign in with your email, not your Chronous username. After signing in, your @handle is shown on your Profile screen.
                </Text>
              </View>
            ) : null}

            {isPasswordRecovery ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRecoveryMode(null);
                  setMessage('');
                }}
              >
                <Text style={styles.backToSignIn}>Back to sign in</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => onModeChange(isSignUp ? 'signIn' : 'signUp')}
            style={styles.switchMode}
          >
            <Text style={styles.switchCopy}>
              {isSignUp ? 'Already have an account? ' : 'New to Chronous? '}
              <Text style={styles.switchAction}>{isSignUp ? 'Sign in' : 'Create one'}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type AuthFieldProps = React.ComponentProps<typeof TextInput> & {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  trailing?: React.ReactNode;
};

function AuthField({ icon, label, trailing, style, ...props }: AuthFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <Ionicons name={icon} size={19} color={colors.muted} />
        <TextInput
          {...props}
          style={[styles.input, style]}
          placeholderTextColor={colors.muted}
          selectionColor={colors.lavender}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  header: { marginTop: spacing.xl },
  eyebrow: { color: colors.mint, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: colors.cream, fontSize: 32, lineHeight: 39, fontWeight: '900', marginTop: 11, letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 12 },
  form: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    gap: spacing.md,
  },
  fieldGroup: { gap: 8 },
  label: { color: colors.cream, fontSize: 13, fontWeight: '700' },
  field: {
    minHeight: 54,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.inkSoft,
  },
  input: { flex: 1, color: colors.cream, fontSize: 15, paddingVertical: 14 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  success: { color: colors.mint, fontSize: 13, lineHeight: 19 },
  recoveryLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  recoveryLink: { color: colors.lavender, fontSize: 13, fontWeight: '800' },
  recoveryDivider: { width: 1, height: 16, backgroundColor: colors.line },
  usernameHelp: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: `${colors.mint}0D`,
    borderWidth: 1,
    borderColor: `${colors.mint}33`,
  },
  usernameHelpText: { color: colors.muted, flex: 1, fontSize: 12, lineHeight: 18 },
  backToSignIn: { color: colors.lavender, textAlign: 'center', fontSize: 13, fontWeight: '800' },
  switchMode: { alignItems: 'center', paddingVertical: spacing.lg },
  switchCopy: { color: colors.muted, fontSize: 14 },
  switchAction: { color: colors.lavender, fontWeight: '800' },
  confirmation: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  confirmationIcon: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: `${colors.mint}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  confirmationTitle: { color: colors.cream, fontSize: 28, fontWeight: '900' },
  confirmationText: { color: colors.muted, textAlign: 'center', fontSize: 15, lineHeight: 23, marginBottom: spacing.md },
});
