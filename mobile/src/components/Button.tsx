import { Ionicons } from '@expo/vector-icons';
import React, { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  right?: ReactNode;
};

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
  right,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? colors.ink : colors.cream} />
        ) : icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={variant === 'primary' ? colors.ink : colors.cream}
          />
        ) : null}
        <Text style={[styles.label, variant === 'primary' && styles.primaryLabel]}>{label}</Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: colors.cream,
  },
  secondary: {
    backgroundColor: colors.panelLight,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  label: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryLabel: {
    color: colors.ink,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
});

