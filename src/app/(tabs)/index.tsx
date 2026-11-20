import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Donut, ProgressRing } from '../../components/charts';
import { TxnItem } from '../../components/TxnItem';
import { Fab } from '../../components/Fab';
import { Card, Empty, Icon, IconBadge, Screen, SectionTitle, Segmented, Text } from '../../components/ui';
import { loadOverview } from '../../features/overview/useOverview';
import { monthLabel } from '../../lib/dates';
import { formatMoney, type Currency } from '../../lib/money';
import { useApp, useQuery } from '../../state/AppState';
import { useTheme } from '../../theme/ThemeProvider';

export default function Overview() {
  const t = useTheme();
  const { settings, updateSettings } = useApp();
  const currency = settings.default_currency;
  const { data } = useQuery((db) => loadOverview(db, currency, settings.last_fx_rate), [currency, settings.last_fx_rate]);
  const [insightIdx, setInsightIdx] = useState(0);

  const fmt = (n: number) => formatMoney(n, currency);
  const fmtC = (n: number) => formatMoney(n, currency, { compact: true });

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text size="sm" muted weight="medium">{data ? monthLabel(data.month) : ' '}</Text>
            <Text size="3xl" weight="extrabold">Overview</Text>
          </View>
          {data && data.streak.days > 0 ? (
            <View
              accessibilityLabel={`${data.streak.days} day logging streak`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: t.radius.pill,
                backgroundColor: t.colors.warningBg,
              }}
            >
              <Icon name="fire" size={18} color={t.colors.warning} />
              <Text weight="bold" color={t.colors.warning}>{data.streak.days}</Text>
            </View>
          ) : null}
        </View>

        {/* Hero: money left to spend this month */}
        <View style={{ backgroundColor: t.colors.primary, borderRadius: t.radius.hero, padding: t.space.xl, gap: 14, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -30, top: -30, opacity: 0.12 }}>
            <Icon name="wallet-outline" size={180} color="#fff" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text size="sm" weight="semibold" color="#dbe6ff">Left to spend this month</Text>
            <Segmented<Currency>
              compact
              options={[{ value: 'NGN', label: '₦ NGN' }, { value: 'USD', label: '$ USD' }]}
              value={currency}
              onChange={(v) => void updateSettings({ default_currency: v })}
            />
          </View>
          <Text size="5xl" weight="extrabold" color="#fff" tabular adjustsFontSizeToFit numberOfLines={1}>
            {data ? fmt(data.summary.left) : '—'}
          </Text>
          {data ? (
            <>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${data.summary.spendableIncome > 0 ? Math.min(data.summary.expenses / data.summary.spendableIncome, 1) * 100 : data.summary.expenses > 0 ? 100 : 0}%`,
                    backgroundColor: data.summary.left < 0 ? '#ffb4ab' : '#fff',
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text size="xs" color="#c9d6ff" weight="semibold">Spendable income</Text>
                  <Text weight="bold" color="#fff" tabular>{fmtC(data.summary.spendableIncome)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text size="xs" color="#c9d6ff" weight="semibold">Spent</Text>
                  <Text weight="bold" color="#fff" tabular>{fmtC(data.summary.expenses)}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {data && data.reviewDue && settings.last_review_week !== data.thisWeek ? (
          <Card onPress={() => router.push('/review')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: t.colors.primary }}>
            <IconBadge icon="calendar-check-outline" color={t.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text weight="bold">Your weekly review is ready</Text>
              <Text size="sm" muted>See how the week went and settle your buckets.</Text>
            </View>
            <Icon name="chevron-right" color={t.colors.textMuted} />
          </Card>
        ) : null}

        {/* Buckets */}
        <SectionTitle title="Buckets" action="Manage" onAction={() => router.navigate('/buckets')} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {data?.buckets.map((b) => {
            const tot = data.totals.get(b.id) ?? { due: 0, moved: 0, pending: 0, openCount: 0 };
            const pct = tot.due > 0 ? Math.floor((tot.moved * 100) / tot.due) : 0;
            return (
              <Card
                key={b.id}
                onPress={() => router.navigate({ pathname: '/buckets', params: { bucket: String(b.id) } })}
                style={{ flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 8 }}
              >
                <ProgressRing value={tot.moved} max={tot.due} color={b.colour} size={60}>
                  <Text size="xs" weight="bold">{pct}%</Text>
                </ProgressRing>
                <Text size="sm" weight="bold">{b.name}</Text>
                <Text size="xs" muted tabular numberOfLines={1} adjustsFontSizeToFit>
                  {tot.pending > 0 ? `${fmtC(tot.pending)} pending` : tot.due > 0 ? 'All set aside' : `${b.percentage}% of income`}
                </Text>
              </Card>
            );
          })}
        </View>

        {/* One insight at a time */}
        {data && data.insights.length ? (() => {
          const ins = data.insights[insightIdx % data.insights.length];
          const tone = { good: t.colors.income, neutral: t.colors.hero, warn: t.colors.warning, bad: t.colors.critical }[ins.tone];
          return (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <IconBadge icon={ins.icon} color={tone} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text size="xs" weight="bold" color={tone}>INSIGHT</Text>
                  <Text weight="bold">{ins.title}</Text>
                  <Text size="sm" muted>{ins.body}</Text>
                </View>
              </View>
              {data.insights.length > 1 ? (
                <Pressable onPress={() => setInsightIdx((i) => i + 1)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
                  <Text size="sm" weight="semibold" color={t.colors.primary}>
                    Next tip ({(insightIdx % data.insights.length) + 1}/{data.insights.length})
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          );
        })() : null}

        {/* Spending breakdown */}
        <SectionTitle title="Spending" />
        <Card>
          {data && data.summary.byCategory.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Donut size={140} stroke={18} parts={data.summary.byCategory.map((c) => ({ value: c.total, color: c.colour }))}>
                <Text size="xs" muted weight="semibold">Spent</Text>
                <Text size="sm" weight="extrabold" tabular adjustsFontSizeToFit numberOfLines={1} style={{ maxWidth: 90 }}>
                  {fmtC(data.summary.expenses)}
                </Text>
              </Donut>
              <View style={{ flex: 1, gap: 8 }}>
                {data.summary.byCategory.slice(0, 5).map((c) => (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.colour }} />
                    <Text size="sm" style={{ flex: 1 }} numberOfLines={1}>{c.name}</Text>
                    <Text size="sm" weight="semibold" tabular>
                      {Math.round((c.total * 100) / Math.max(data.summary.expenses, 1))}%
                    </Text>
                  </View>
                ))}
                {data.summary.byCategory.length > 5 ? (
                  <Text size="xs" muted>+{data.summary.byCategory.length - 5} more</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Empty icon="chart-donut" title="No spending yet this month" body="Your breakdown by category appears here." />
          )}
        </Card>

        {/* Recent */}
        <SectionTitle title="Recent" action="See all" onAction={() => router.navigate('/transactions')} />
        <Card style={{ paddingVertical: 4 }}>
          {data && data.recent.length ? (
            data.recent.map((r, i) => (
              <View key={r.id} style={i ? { borderTopWidth: 1, borderTopColor: t.colors.border } : undefined}>
                <TxnItem txn={r} onPress={() => router.push({ pathname: '/entry', params: { id: String(r.id) } })} />
              </View>
            ))
          ) : (
            <Empty icon="plus-circle-outline" title="Nothing logged yet" body="Tap + to record your first expense or income." />
          )}
        </Card>
      </Screen>
      <Fab />
    </View>
  );
}
