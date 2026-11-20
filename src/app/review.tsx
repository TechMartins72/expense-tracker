// Weekly review: what came in, what went out, and the bucket money still to set aside.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useToast } from '../components/toast';
import { Button, Card, Icon, IconBadge, Screen, Text } from '../components/ui';
import { allAllocations, listBuckets, listTransactions, setAmountMoved } from '../db/repo';
import { addDays, dayLabel, today, weekStart } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { bucketTotals, summarise } from '../lib/summary';
import { useApp, useQuery } from '../state/AppState';
import { useTheme } from '../theme/ThemeProvider';

export default function Review() {
  const t = useTheme();
  const toast = useToast();
  const { db, settings, updateSettings, changed } = useApp();
  const currency = settings.default_currency;
  const start = weekStart(today());

  const { data } = useQuery(
    async (d) => {
      const [rows, buckets, allocs] = await Promise.all([
        listTransactions(d, { from: start, to: addDays(start, 6) }),
        listBuckets(d),
        allAllocations(d),
      ]);
      const open = allocs.filter((a) => a.status !== 'done' && a.amount_due > 0);
      return { week: summarise(rows, currency), days: new Set(rows.map((r) => r.date)).size, buckets, totals: bucketTotals(allocs, currency), open };
    },
    [start, currency],
  );

  async function settleAll() {
    if (!data) return;
    for (const a of data.open) await setAmountMoved(db, a.id, a.amount_due);
    await changed();
    toast('All pending allocations marked as done');
  }

  async function finish() {
    await updateSettings({ last_review_week: start });
    router.back();
  }

  const fmt = (n: number) => formatMoney(n, currency, { compact: true });
  const top = data?.week.byCategory[0];

  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable accessibilityLabel="Close" onPress={() => router.back()} hitSlop={10} style={{ alignSelf: 'flex-start', padding: 4 }}>
        <Icon name="close" size={26} />
      </Pressable>
      <View>
        <Text size="sm" muted weight="medium">Week of {dayLabel(start)}</Text>
        <Text size="3xl" weight="extrabold">Weekly review</Text>
      </View>

      {data ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Came in" value={fmt(data.week.income)} color={t.colors.income} />
            <Stat label="Went out" value={fmt(data.week.expenses)} color={t.colors.expense} />
          </View>
          <Card style={{ gap: 6 }}>
            <Text weight="bold">
              You logged on {data.days} of 7 days{data.days >= 5 ? '. Great consistency.' : '.'}
            </Text>
            {top ? <Text muted>Most spent on {top.name}: {fmt(top.total)}.</Text> : <Text muted>No spending logged this week.</Text>}
          </Card>

          <Text size="xl" weight="bold">Settle your buckets</Text>
          <Card style={{ gap: 12 }}>
            {data.buckets.map((b) => {
              const tot = data.totals.get(b.id);
              return (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconBadge icon="tray-arrow-down" color={b.colour} size={36} />
                  <Text weight="semibold" style={{ flex: 1 }}>{b.name}</Text>
                  <Text weight="bold" tabular color={tot?.pending ? t.colors.warning : t.colors.income}>
                    {tot?.pending ? `${fmt(tot.pending)} pending` : 'Settled'}
                  </Text>
                </View>
              );
            })}
          </Card>
          {data.open.length ? (
            <>
              <Text size="sm" muted>Already moved all of it? Mark everything done at once, or settle each one in Buckets.</Text>
              <Button label={`Mark all ${data.open.length} as done`} icon="check-all" onPress={settleAll} />
              <Button label="Settle one by one" variant="secondary" onPress={() => { router.back(); router.navigate('/buckets'); }} />
            </>
          ) : null}
          <Button label="Finish review" variant={data.open.length ? 'ghost' : 'primary'} onPress={finish} />
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <Text size="sm" muted weight="semibold">{label}</Text>
      <Text size="xl" weight="extrabold" tabular color={color} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </Card>
  );
}
