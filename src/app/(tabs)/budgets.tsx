import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AmountField, Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { Button, Card, Header, Icon, IconBadge, ProgressBar, Screen, Segmented, Text } from '../../components/ui';
import { budgetsFor, listCategories, listTransactions, setBudget, UserError, type Category } from '../../db/repo';
import { addMonths, monthLabel, monthOf, today } from '../../lib/dates';
import { budgetLevel } from '../../lib/insights';
import { convert, formatMoney, minorToInput, parseMinor, SYMBOL, type Currency } from '../../lib/money';
import { useApp, useQuery } from '../../state/AppState';
import { useTheme } from '../../theme/ThemeProvider';

type Line = { cat: Category; limit: number; currency: Currency; spent: number };

export default function Budgets() {
  const t = useTheme();
  const { settings } = useApp();
  const thisMonth = monthOf(today());
  const [month, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState<{ cat: Category; limit: number; currency: Currency } | null>(null);

  const { data } = useQuery(
    async (db) => {
      const [cats, budgets, rows] = await Promise.all([
        listCategories(db, 'expense'),
        budgetsFor(db, month),
        listTransactions(db, { month, type: 'expense' }),
      ]);
      const withBudget: Line[] = [];
      const without: Category[] = [];
      for (const cat of [...cats].sort((a, b) => a.sort_order - b.sort_order)) {
        const b = budgets.get(cat.id);
        if (!b) {
          without.push(cat);
          continue;
        }
        // Spending is converted into the budget's currency with each entry's own rate.
        const spent = rows
          .filter((r) => r.category_id === cat.id)
          .reduce((a, r) => a + convert(r.amount, r.currency, b.currency, r.fx_rate_to_ngn), 0);
        withBudget.push({ cat, limit: b.limit_amount, currency: b.currency, spent });
      }
      return { withBudget, without };
    },
    [month],
  );

  const color = (lvl: ReturnType<typeof budgetLevel>) =>
    lvl === 'over' ? t.colors.critical : lvl === 'warn' ? t.colors.warning : t.colors.income;

  return (
    <Screen>
      <Header title="Budgets" subtitle="Monthly limits from your spendable money" />

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

      {data?.withBudget.map((l) => {
        const lvl = budgetLevel(l.spent, l.limit);
        const pct = Math.floor((l.spent * 100) / l.limit);
        return (
          <Card key={l.cat.id} onPress={() => setEditing({ cat: l.cat, limit: l.limit, currency: l.currency })} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBadge icon={l.cat.icon} color={l.cat.colour} />
              <View style={{ flex: 1 }}>
                <Text weight="bold">{l.cat.name}</Text>
                <Text size="sm" muted tabular>
                  {formatMoney(l.spent, l.currency, { compact: true })} of {formatMoney(l.limit, l.currency, { compact: true })}
                </Text>
              </View>
              <Text weight="extrabold" tabular color={color(lvl)}>{pct}%</Text>
            </View>
            <ProgressBar value={l.spent} max={l.limit} color={color(lvl)} />
            {lvl !== 'ok' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name={lvl === 'over' ? 'alert-octagon' : 'alert'} size={16} color={color(lvl)} />
                <Text size="sm" weight="semibold" color={color(lvl)}>
                  {lvl === 'over'
                    ? `Over by ${formatMoney(l.spent - l.limit, l.currency, { compact: true })}`
                    : `${formatMoney(l.limit - l.spent, l.currency, { compact: true })} left`}
                </Text>
              </View>
            ) : null}
          </Card>
        );
      })}

      {data && data.withBudget.length === 0 ? (
        <Card>
          <Text weight="bold">No budgets yet</Text>
          <Text size="sm" muted>Set a monthly limit for a category below. It carries over to the next months until you change it. You'll get a warning at 80% and at 100%.</Text>
        </Card>
      ) : null}

      {data && data.without.length ? (
        <>
          <Text size="lg" weight="bold" style={{ marginTop: 8 }}>No limit set</Text>
          <Card style={{ paddingVertical: 4 }}>
            {data.without.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => setEditing({ cat: c, limit: 0, currency: settings.default_currency })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.colors.border }}
              >
                <IconBadge icon={c.icon} color={c.colour} size={34} />
                <Text style={{ flex: 1 }}>{c.name}</Text>
                <Text size="sm" weight="semibold" color={t.colors.primary}>Set limit</Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <BudgetSheet month={month} editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function BudgetSheet({
  month,
  editing,
  onClose,
}: {
  month: string;
  editing: { cat: Category; limit: number; currency: Currency } | null;
  onClose: () => void;
}) {
  const { db, changed } = useApp();
  const toast = useToast();
  const [input, setInput] = useState('');
  const [currency, setCurrency] = useState<Currency>('NGN');
  useEffect(() => {
    if (!editing) return;
    setInput(editing.limit ? minorToInput(editing.limit) : '');
    setCurrency(editing.currency);
  }, [editing]);

  async function save(limit: number | null) {
    if (!editing) return;
    if (limit === null) {
      toast('Enter an amount like 50000 or 49.99.', 'error');
      return;
    }
    try {
      await setBudget(db, editing.cat.id, month, limit, currency);
      await changed();
      toast(limit ? `${editing.cat.name} budget saved` : `${editing.cat.name} budget removed`, limit ? 'success' : 'info');
      onClose();
    } catch (e) {
      toast(e instanceof UserError ? e.message : 'Could not save.', 'error');
    }
  }

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing ? `${editing.cat.name} budget` : ''}>
      <Text muted>Monthly limit from {monthLabel(month)} onward.</Text>
      <Segmented<Currency>
        compact
        options={[{ value: 'NGN', label: '₦ NGN' }, { value: 'USD', label: '$ USD' }]}
        value={currency}
        onChange={setCurrency}
      />
      <AmountField value={input} onChange={setInput} prefix={SYMBOL[currency]} autoFocus />
      <Button label="Save limit" onPress={() => save(parseMinor(input || 'x'))} />
      {editing?.limit ? <Button label="Remove budget" variant="danger" onPress={() => save(0)} /> : null}
    </Sheet>
  );
}
