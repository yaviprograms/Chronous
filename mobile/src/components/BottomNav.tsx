import { Ionicons } from '@expo/vector-icons';
import React, { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../types';
import { colors, radius } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const items: { key: AppScreen; label: string; icon: IconName; activeIcon: IconName }[] = [
  { key: 'home', label: 'Today', icon: 'sparkles-outline', activeIcon: 'sparkles' },
  { key: 'vault', label: 'Vault', icon: 'albums-outline', activeIcon: 'albums' },
  { key: 'create', label: 'Create', icon: 'add', activeIcon: 'add' },
  { key: 'insights', label: 'Journey', icon: 'pulse-outline', activeIcon: 'pulse' },
  { key: 'profile', label: 'You', icon: 'person-outline', activeIcon: 'person' },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: AppScreen;
  onChange: (screen: AppScreen) => void;
}) {
  return (
    <View style={styles.shell}>
      {items.map((item) => {
        const isActive = active === item.key;
        const isCreate = item.key === 'create';
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
            style={styles.item}
          >
            <View style={[styles.iconWrap, isCreate && styles.create, isActive && !isCreate && styles.active]}>
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={isCreate ? 25 : 20}
                color={isCreate ? colors.ink : isActive ? colors.cream : colors.muted}
              />
            </View>
            {!isCreate ? (
              <Text style={[styles.label, isActive && styles.activeLabel]}>{item.label}</Text>
            ) : (
              <Text style={styles.createLabel}>Create</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
    height: 72,
    backgroundColor: 'rgba(16,27,46,0.97)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    height: 32,
    width: 42,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.panelLight,
  },
  create: {
    height: 46,
    width: 46,
    marginTop: -24,
    backgroundColor: colors.cream,
    borderWidth: 4,
    borderColor: colors.ink,
  },
  label: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  activeLabel: {
    color: colors.cream,
  },
  createLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
});
