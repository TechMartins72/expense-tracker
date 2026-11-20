import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from '../../components/Fab';
import { TxnItem } from '../../components/TxnItem';
import { Chip, Empty, Header, Icon, Segmented, Text } from '../../components/ui';
import { listCategories, listTransactions, type Kind, type TxnRow } from '../../db/repo';
import { addMonths, dayLabel, monthLabel, monthOf, today } from '../../lib/dates';
import { formatMoney, type Currency } from '../../lib/money';
import { useQuery } from '../../state/AppState';
import { useTheme } from '../../theme/ThemeProvider';

type Any<T> = T | 'all';

export default function Transactions() {
  const t = useTheme();
  const thisMonth = monthOf(today());
  const [month, setMonth] = useState(thisMonth);
  const [type, setType] = useState<Any<Kind>>('all');
  const [currency, setCurrency] = useState<Any<Currency>>('all');
  const [categoryId, setCategoryId] = useState<number>();

  const { data: rows } = useQuery(
    (db) =>
      listTransactions(db, {
        month,
        type: type === 'all' ? undefined : type,
        currency: currency === 'all' ? undefined : currency,
        categoryId,
      }),
    [month, type, currency, categoryId],
  );
  const { data: cats } = useQuery(
    async (db) => {
      const kinds: Kind[] = type === 'all' ? ['expense', 'income'] : [type];
      return (await Promise.all(kinds.map((k) => listCategories(db, k, true)))).flat();
    },
    [type],
  );

  const sections = useMemo(() => {
    const byDay = new Map<string, TxnRow[]>();
    for (const r of rows ?? []) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
    return [...byDay.entries()].map(([day, data]) => ({ day, data }));
  }, [rows]);

  // Totals per currency (no conversion: what's listed is what's summed).
  const totals = useMemo(() => {
    const out: Record<Currency, { in: number; out: number }> = { NGN: { in: 0, out: 0 }, USD: { in: 0, out: 0 } };
    for (const r of rows ?? []) out[r.currency][r.type === 'income' ? 'in' : 'out'] += r.amount;
    return out;
  }, [rows]);

  const header = (
    <View style={{ gap: 14, paddingBottom: 8 }}>
      <Header title="Activity" subtitle="Every income and expense" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Previous month" onPress={() => setMonth((m) => addMonths(m, -1))} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="chevron-left" size={26} />
        </Pressable>
        <Text size="lg" weight="bold">{monthLabel(month)}</Text>
        <Pressable
          accessibilityLabel="Next month"
          disabled={month >= thisMonth}
          onPress={() => setMonth((m) => addMonths(m, 1))}
          hitSlop={10}
          style={{ padding: 6, opacity: month >= thisMonth ? 0.3 : 1 }}
        >
          <Icon name="chevron-right" size={26} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 3 }}>
          <Segmented<Any<Kind>>
            options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Out' }, { value: 'income', label: 'In' }]}
            value={type}
            onChange={(v) => {
              setType(v);
              setCategoryId(undefined);
            }}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Segmented<Any<Currency>>
            options={[{ value: 'all', label: 'Both' }, { value: 'NGN', label: '₦' }, { value: 'USD', label: '$' }]}
            value={currency}
            onChange={setCurrency}
          />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All categories" selected={!categoryId} onPress={() => setCategoryId(undefined)} />
        {cats?.map((c) => (
          <Chip
            key={c.id}
            label={type === 'all' ? `${c.name}${c.kind === 'income' ? ' (in)' : ''}` : c.name}
            icon={c.icon}
            color={c.colour}
            selected={c.id === categoryId}
            onPress={() => setCategoryId(c.id === categoryId ? undefined : c.id)}
          />
        ))}
      </ScrollView>
      {rows && rows.length ? (
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          {(['NGN', 'USD'] as Currency[]).map((c) =>
            totals[c].in || totals[c].out ? (
              <Text key={c} size="sm" muted tabular>
                <Text size="sm" weight="bold" color={t.colors.income}>{formatMoney(totals[c].in, c, { compact: true, sign: true })}</Text>
                {'  '}
                <Text size="sm" weight="bold" color={t.colors.expense}>{formatMoney(-totals[c].out, c, { compact: true })}</Text>
              </Text>
            ) : null,
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <SectionList
        sections={sections}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text size="sm" weight="bold" muted style={{ marginTop: 12, marginBottom: 2 }}>{dayLabel(section.day)}</Text>
        )}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: t.colors.surfaceRaised, borderRadius: t.radius.md, paddingHorizontal: 12, marginTop: 6, borderWidth: 1, borderColor: t.colors.border }}>
            <TxnItem txn={item} showDate={false} onPress={() => router.push({ pathname: '/entry', params: { id: String(item.id) } })} />
          </View>
        )}
        ListEmptyComponent={
          rows ? <Empty icon="magnify" title="Nothing here" body="No entries match these filters for this month." /> : undefined
        }
      />
      <Fab />
    </SafeAreaView>
  );
}
