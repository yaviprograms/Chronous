import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { getCountdown } from '../utils/time';

type CountdownProps = {
  unlockAt: string;
  compact?: boolean;
  accent?: string;
};

export function Countdown({ unlockAt, compact = false, accent = colors.lavender }: CountdownProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => getCountdown(unlockAt, now), [now, unlockAt]);
  const units = [
    { value: countdown.days, label: 'DAYS' },
    { value: countdown.hours, label: 'HRS' },
    { value: countdown.minutes, label: 'MIN' },
    { value: countdown.seconds, label: 'SEC' },
  ];

  if (countdown.isUnlocked) {
    return (
      <View style={[styles.ready, { borderColor: accent }]}>
        <View style={[styles.readyDot, { backgroundColor: accent }]} />
        <Text style={styles.readyText}>READY TO OPEN</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, compact && styles.compactRow]}>
      {units.map((unit, index) => (
        <React.Fragment key={unit.label}>
          <View style={[styles.unit, compact && styles.compactUnit]}>
            <Text style={[styles.value, compact && styles.compactValue]}>
              {String(unit.value).padStart(2, '0')}
            </Text>
            <Text style={styles.label}>{unit.label}</Text>
          </View>
          {index < units.length - 1 ? <Text style={styles.divider}>:</Text> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  compactRow: {
    justifyContent: 'flex-start',
    gap: 5,
  },
  unit: {
    minWidth: 58,
    alignItems: 'center',
    backgroundColor: 'rgba(5, 11, 22, 0.38)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  compactUnit: {
    minWidth: 41,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  value: {
    color: colors.cream,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  compactValue: {
    fontSize: 16,
  },
  label: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 3,
  },
  divider: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '700',
  },
  ready: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.round,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  readyDot: {
    width: 7,
    height: 7,
    borderRadius: radius.round,
  },
  readyText: {
    color: colors.cream,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
  },
});

