import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CapsuleCard } from '../components/CapsuleCard';
import { useCapsules } from '../store/CapsuleContext';
import { Capsule } from '../types';
import { colors, radius, spacing } from '../theme';
import { getCountdown } from '../utils/time';

type Filter = 'all' | 'drafts' | 'sealed' | 'ready' | 'opened';

export function VaultScreen({ onOpen }: { onOpen: (capsule: Capsule) => void }) {
  const { capsules } = useCapsules();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      capsules.filter((capsule) => {
        const unlocked = getCountdown(capsule.unlockAt).isUnlocked;
        const matchesFilter =
          filter === 'all' ||
          (filter === 'drafts' && capsule.status === 'draft') ||
          (filter === 'sealed' && !unlocked && capsule.status === 'sealed') ||
          (filter === 'ready' && unlocked && capsule.status !== 'opened') ||
          (filter === 'opened' && capsule.status === 'opened');
        const haystack = `${capsule.title} ${capsule.subtitle} ${capsule.type}`.toLowerCase();
        return matchesFilter && haystack.includes(query.toLowerCase());
      }),
    [capsules, filter, query],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR ARCHIVE</Text>
            <Text style={styles.title}>The vault</Text>
          </View>
          <View style={styles.count}>
            <Text style={styles.countValue}>{capsules.length}</Text>
            <Text style={styles.countLabel}>CAPSULES</Text>
          </View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search memories, goals, letters..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            selectionColor={colors.lavender}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['all', 'drafts', 'sealed', 'ready', 'opened'] as Filter[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[styles.filter, filter === item && styles.activeFilter]}
            >
              <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>
                {item[0]?.toUpperCase()}
                {item.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.resultMeta}>
          <Text style={styles.resultCount}>
            {filtered.length} {filtered.length === 1 ? 'capsule' : 'capsules'}
          </Text>
          <View style={styles.sort}>
            <Ionicons name="swap-vertical-outline" size={14} color={colors.muted} />
            <Text style={styles.sortText}>Unlock date</Text>
          </View>
        </View>

        <View style={styles.list}>
          {filtered.map((capsule) => (
            <CapsuleCard key={capsule.id} capsule={capsule} onPress={() => onOpen(capsule)} />
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="archive-outline" size={28} color={colors.lavender} />
            </View>
            <Text style={styles.emptyTitle}>Nothing tucked away here</Text>
            <Text style={styles.emptyText}>Try another filter or a different search.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: 116 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 23 },
  eyebrow: { color: colors.lavender, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.cream, fontSize: 31, fontWeight: '700', letterSpacing: -0.8, marginTop: 3 },
  count: {
    width: 64,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countValue: { color: colors.cream, fontSize: 18, fontWeight: '800' },
  countLabel: { color: colors.muted, fontSize: 7, fontWeight: '700', letterSpacing: 1 },
  search: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, color: colors.cream, fontSize: 13, paddingVertical: 12 },
  filters: { gap: 8, paddingVertical: 16 },
  filter: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.round,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  activeFilter: { backgroundColor: colors.cream, borderColor: colors.cream },
  filterText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  activeFilterText: { color: colors.ink },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 5,
  },
  resultCount: { color: colors.muted, fontSize: 11 },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: colors.muted, fontSize: 10 },
  list: { gap: 11 },
  empty: { alignItems: 'center', marginTop: 60, gap: 7 },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: `${colors.lavender}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { color: colors.cream, fontSize: 16, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 12 },
});
