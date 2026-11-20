// Quick entry: the fastest path in the app. Amount -> (category is pre-picked) -> Save.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/toast';
import { Button, Chip, Icon, Segmented, Text } from '../components/ui';
import {
  deleteTransaction,
  getTransaction,
  listBuckets,
  listCategories,
  saveTransaction,
  UserError,
  type Kind,
} from '../db/repo';
import { addDays, dayLabel, today } from '../lib/dates';
import { formatMoney, minorToInput, parseMinor, SYMBOL, type Currency } from '../lib/money';
import { splitIncome } from '../lib/split';
import { useApp, useQuery } from '../state/AppState';
import { useTheme } from '../theme/ThemeProvider';

/** "12500.5" -> "12,500.5" while typing (keeps a trailing "." visible). */
function padDisplay(input: string): string {
  if (!input) return '0';
  const [whole, frac] = input.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

const KEYS = ['1','2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

export default function Entry() {
  const t = useTheme();
  const toast = useToast();
  const { db, settings, changed } = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [type, setType] = useState<Kind>('expense');
  const [input, setInput] = useState('');
  const [currency, setCurrency] = useState<Currency>(settings.last_currency);
  const [categoryId, setCategoryId] = useState<number>();
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [rate, setRate] = useState(settings.last_fx_rate);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editId);

  // Load the entry being edited.
  useEffect(() => {
    if (!editId) return;
    getTransaction(db, editId).then((tx) => {
      if (!tx) {
        router.back();
        return;
      }
      setType(tx.type);
      setInput(minorToInput(tx.amount));
      setCurrency(tx.currency);
      setCategoryId(tx.category_id);
      setDate(tx.date);
      setNote(tx.note ?? '');
      setNoteOpen(!!tx.note);
      setRate(tx.fx_rate_to_ngn); // an edit keeps the rate it was entered with
      setLoaded(true);
    });
  }, [db, editId]);

  const { data: cats } = useQuery((d) => listCategories(d, type), [type]);
  const { data: buckets } = useQuery((d) => listBuckets(d), []);

  // Pre-pick the most used category so most entries are amount + Save.
  useEffect(() => {
    if (!cats || !loaded) return;
    if (!cats.some((c) => c.id === categoryId)) setCategoryId(cats[0]?.id);
  }, [cats, loaded, categoryId]);

  const amount = parseMinor(input || '0') ?? 0;
  const accent = type === 'income' ? t.colors.income : t.colors.expense;

  const split = useMemo(() => {
    if (type !== 'income' || !buckets) return null;
    return splitIncome(amount, buckets.map((b) => ({ bucketId: b.id, percentage: b.percentage })));
  }, [type, buckets, amount]);

  function press(key: (typeof KEYS)[number]) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput((cur) => {
      if (key === 'back') return cur.slice(0, -1);
      if (key === '.') return cur.includes('.') ? cur : (cur || '0') + '.';
      const next = cur === '0' ? key : cur + key;
      return parseMinor(next) === null ? cur : next; // refuses a 3rd decimal or a too-large amount
    });
  }

  async function save() {
    if (amount <= 0) {
      toast('Enter an amount first.', 'error');
      return;
    }
    if (!categoryId) {
      toast('Pick a category.', 'error');
      return;
    }
    setBusy(true);
    try {
      await saveTransaction(
        db,
        { type, amount, currency, categoryId, date, note: note.trim() || null, fxRateToNgn: rate },
        editId,
      );
      await changed();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`${type === 'income' ? 'Income' : 'Expense'} of ${formatMoney(amount, currency)} ${editId ? 'updated' : 'saved'}`);
      router.back();
    } catch (e) {
      toast(e instanceof UserError ? e.message : 'Could not save. Please try again.', 'error');
      if (!(e instanceof UserError)) console.warn(e);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!editId) return;
    Alert.alert(
      'Delete this entry?',
      type === 'income' ? 'Its bucket allocations are deleted too, including anything marked as set aside.' : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(db, editId);
            await changed();
            toast('Entry deleted', 'info');
            router.back();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: t.colors.surface }}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 }}>
        <Pressable accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12} style={{ padding: 8 }}>
          <Icon name="close" size={26} />
        </Pressable>
        <Text weight="bold" size="lg">{editId ? 'Edit entry' : 'New entry'}</Text>
        {editId ? (
          <Pressable accessibilityLabel="Delete entry" onPress={remove} hitSlop={12} style={{ padding: 8 }}>
            <Icon name="trash-can-outline" size={24} color={t.colors.critical} />
          </Pressable>
        ) : (
          <View style={{ width: 42 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <Segmented<Kind>
          options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]}
          value={type}
          onChange={setType}
          colors={{ expense: t.colors.expense, income: t.colors.income }}
        />

        {/* Amount + currency */}
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <Text
            accessibilityLabel={`Amount ${formatMoney(amount, currency)}`}
            weight="extrabold"
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: 52, lineHeight: 64, color: input ? accent : t.colors.textMuted }}
          >
            {SYMBOL[currency]}
            {padDisplay(input)}
          </Text>
          <Segmented<Currency>
            compact
            options={[{ value: 'NGN', label: '₦ NGN' }, { value: 'USD', label: '$ USD' }]}
            value={currency}
            onChange={setCurrency}
          />
        </View>

        {/* Categories: one row, most used first */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {cats?.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={c.icon}
              color={c.colour}
              selected={c.id === categoryId}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </ScrollView>

        {/* Live split preview for income */}
        {split && buckets ? (
          <View style={{ flexDirection: 'row', backgroundColor: t.colors.surfaceRaised, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: 10 }}>
            {buckets.map((b, i) => (
              <View key={b.id} style={{ flex: 1, alignItems: 'center' }}>
                <Text size="xs" weight="bold" color={b.colour}>{b.name} {b.percentage}%</Text>
                <Text size="sm" weight="semibold" tabular numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(split.lines[i].amountDue, currency, { compact: true })}
                </Text>
              </View>
            ))}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text size="xs" weight="bold" color={t.colors.income}>Spendable</Text>
              <Text size="sm" weight="semibold" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(split.spendable, currency, { compact: true })}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Date and note */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityLabel="Previous day" onPress={() => setDate((d) => addDays(d, -1))} hitSlop={8} style={{ padding: 6 }}>
            <Icon name="chevron-left" />
          </Pressable>
          <Text weight="semibold" style={{ minWidth: 84, textAlign: 'center' }}>{dayLabel(date)}</Text>
          <Pressable
            accessibilityLabel="Next day"
            disabled={date >= today()}
            onPress={() => setDate((d) => addDays(d, 1))}
            hitSlop={8}
            style={{ padding: 6, opacity: date >= today() ? 0.3 : 1 }}
          >
            <Icon name="chevron-right" />
          </Pressable>
          <View style={{ flex: 1 }} />
          {!noteOpen ? (
            <Pressable onPress={() => setNoteOpen(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}>
              <Icon name="note-plus-outline" size={20} color={t.colors.primary} />
              <Text size="sm" weight="semibold" color={t.colors.primary}>Add note</Text>
            </Pressable>
          ) : null}
        </View>
        {noteOpen ? (
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor={t.colors.textMuted}
            maxLength={120}
            autoFocus={!note}
            style={{
              fontFamily: t.fonts.regular,
              fontSize: t.size.base,
              color: t.colors.text,
              backgroundColor: t.colors.surfaceRaised,
              borderWidth: 1,
              borderColor: t.colors.border,
              borderRadius: t.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          />
        ) : null}
      </ScrollView>

      {/* Number pad + save */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={k === 'back' ? 'Delete digit' : k === '.' ? 'Decimal point' : k}
              onPress={() => press(k)}
              onLongPress={k === 'back' ? () => setInput('') : undefined}
              style={({ pressed }) => ({
                width: '33.333%',
                height: 58,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: t.radius.lg,
                backgroundColor: pressed ? t.colors.track : 'transparent',
              })}
            >
              {k === 'back' ? <Icon name="backspace-outline" size={26} /> : <Text size="3xl" weight="semibold">{k}</Text>}
            </Pressable>
          ))}
        </View>
        <Button
          label={editId ? 'Save changes' : type === 'income' ? 'Save income' : 'Save expense'}
          onPress={save}
          busy={busy}
          disabled={amount <= 0}
          color={accent}
          style={{ minHeight: 60, borderRadius: t.radius.card }}
        />
      </View>
    </SafeAreaView>
  );
}
