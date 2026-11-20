import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ProgressRing } from '../../components/charts';
import { AmountField, Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { Button, Card, Empty, Header, Screen, Segmented, Text } from '../../components/ui';
import { allAllocations, listAllocations, listBuckets, setAmountMoved, UserError, type AllocationRow } from '../../db/repo';
import { dayLabel } from '../../lib/dates';
import { formatMoney, minorToInput, parseMinor, SYMBOL } from '../../lib/money';
import { bucketTotals } from '../../lib/summary';
import { useApp, useQuery } from '../../state/AppState';
import { useTheme } from '../../theme/ThemeProvider';

export default function Buckets() {
  const t = useTheme();
  const { settings } = useApp();
  const params = useLocalSearchParams<{ bucket?: string }>();
  const { data: buckets } = useQuery((db) => listBuckets(db), []);
  const [selected, setSelected] = useState<string>();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [editing, setEditing] = useState<AllocationRow | null>(null);

  useEffect(() => {
    if (params.bucket) setSelected(params.bucket);
  }, [params.bucket]);
  const bucketId = Number(selected ?? buckets?.[0]?.id ?? 0);
  const bucket = buckets?.find((b) => b.id === bucketId);

  const currency = settings.default_currency;
  const { data } = useQuery(
    async (db) => {
      const [rows, all] = await Promise.all([listAllocations(db, bucketId), allAllocations(db)]);
      return { rows, totals: bucketTotals(all, currency).get(bucketId) };
    },
    [bucketId, currency],
  );

  const rows = data?.rows.filter((r) => filter === 'all' || r.status !== 'done') ?? [];
  const tot = data?.totals ?? { due: 0, moved: 0, pending: 0, openCount: 0 };

  return (
    <Screen>
      <Header title="Buckets" subtitle="Money you've promised to set aside" />
      {buckets ? (
        <Segmented
          options={buckets.map((b) => ({ value: String(b.id), label: b.name }))}
          value={String(bucketId)}
          onChange={setSelected}
          colors={Object.fromEntries(buckets.map((b) => [String(b.id), b.colour]))}
        />
      ) : null}

      {bucket ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ProgressRing value={tot.moved} max={tot.due} color={bucket.colour} size={88} stroke={9}>
            <Text weight="extrabold">{tot.due > 0 ? Math.floor((tot.moved * 100) / tot.due) : 0}%</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 6 }}>
            <Row label="Set aside" value={formatMoney(tot.moved, currency)} color={bucket.colour} />
            <Row label="Pending" value={formatMoney(tot.pending, currency)} color={tot.pending > 0 ? t.colors.warning : t.colors.textMuted} />
            <Text size="xs" muted>{bucket.percentage}% of every income · totals in {currency}</Text>
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text size="xl" weight="bold">Allocations</Text>
        <Segmented
          compact
          options={[{ value: 'open', label: `Open${tot.openCount ? ` (${tot.openCount})` : ''}` }, { value: 'all', label: 'All' }]}
          value={filter}
          onChange={setFilter}
        />
      </View>

      <Card style={{ paddingVertical: 4 }}>
        {rows.length ? (
          rows.map((r, i) => (
            <View key={r.id} style={i ? { borderTopWidth: 1, borderTopColor: t.colors.border } : undefined}>
              <AllocationItem row={r} onPress={() => setEditing(r)} />
            </View>
          ))
        ) : (
          <Empty
            icon={filter === 'open' ? 'check-all' : 'tray'}
            title={filter === 'open' ? 'Nothing pending' : 'No allocations yet'}
            body={filter === 'open' ? 'Everything due to this bucket has been set aside.' : 'Log an income and its share appears here.'}
          />
        )}
      </Card>

      <MoveSheet row={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Text size="sm" muted>{label}</Text>
      <Text weight="bold" tabular color={color}>{value}</Text>
    </View>
  );
}

function AllocationItem({ row, onPress }: { row: AllocationRow; onPress: () => void }) {
  const t = useTheme();
  const badge = {
    pending: { label: 'Pending', fg: t.colors.warning, bg: t.colors.warningBg },
    partial: { label: 'Partly done', fg: t.colors.hero, bg: t.colors.hero + '22' },
    done: { label: 'Done', fg: t.colors.income, bg: t.colors.incomeBg },
  }[row.status];
  return (
    <Card onPress={onPress} style={{ borderWidth: 0, paddingHorizontal: 0, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text weight="semibold">{formatMoney(row.amount_due, row.currency)}</Text>
        <Text size="sm" muted numberOfLines={1}>
          {row.percentage}% of {formatMoney(row.income_amount, row.currency, { compact: true })} {row.category_name} · {dayLabel(row.date)}
        </Text>
        {row.status === 'partial' ? (
          <Text size="xs" muted>{formatMoney(row.amount_moved, row.currency)} set aside so far</Text>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: badge.bg }}>
        <Text size="xs" weight="bold" color={badge.fg}>{badge.label}</Text>
      </View>
    </Card>
  );
}

function MoveSheet({ row, onClose }: { row: AllocationRow | null; onClose: () => void }) {
  const { db, changed } = useApp();
  const toast = useToast();
  const [input, setInput] = useState('');
  useEffect(() => {
    if (row) setInput(row.amount_moved ? minorToInput(row.amount_moved) : '');
  }, [row]);

  async function apply(amount: number | null) {
    if (!row) return;
    if (amount === null) {
      toast('Enter an amount like 1500 or 12.50.', 'error');
      return;
    }
    try {
      await setAmountMoved(db, row.id, amount);
      await changed();
      toast(amount >= row.amount_due ? 'Marked as done' : amount > 0 ? 'Partial amount saved' : 'Marked as pending');
      onClose();
    } catch (e) {
      toast(e instanceof UserError ? e.message : 'Could not save.', 'error');
    }
  }

  return (
    <Sheet visible={!!row} onClose={onClose} title={row ? `Set aside ${formatMoney(row.amount_due, row.currency)}` : ''}>
      {row ? (
        <>
          <Text muted>Mark it done when you've actually moved the money. If you moved only part, enter how much.</Text>
          <Button label="Mark all done" icon="check" onPress={() => apply(row.amount_due)} />
          <AmountField value={input} onChange={setInput} prefix={SYMBOL[row.currency]} placeholder="Amount moved so far" />
          <Button label="Save partial amount" variant="secondary" onPress={() => apply(parseMinor(input || '0'))} />
          {row.amount_moved > 0 ? <Button label="Reset to pending" variant="ghost" onPress={() => apply(0)} /> : null}
        </>
      ) : null}
    </Sheet>
  );
}
