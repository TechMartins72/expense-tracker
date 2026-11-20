import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AmountField } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { Button, Card, Header, Icon, Screen, Segmented, Text } from '../../components/ui';
import { listBuckets, setBucketPercentages, UserError, type Bucket, type Settings } from '../../db/repo';
import { formatRate, parseRate, type Currency } from '../../lib/money';
import { validatePercentages } from '../../lib/split';
import { useApp, useQuery } from '../../state/AppState';
import { useTheme } from '../../theme/ThemeProvider';

export default function SettingsScreen() {
  const t = useTheme();
  const { settings, updateSettings } = useApp();

  return (
    <Screen>
      <Header title="Settings" />

      <BucketSplit />

      <Card style={{ gap: 12 }}>
        <Text size="lg" weight="bold">Appearance</Text>
        <Segmented<Settings['theme']>
          options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          value={settings.theme}
          onChange={(v) => void updateSettings({ theme: v })}
        />
        <Text size="lg" weight="bold" style={{ marginTop: 4 }}>Default currency</Text>
        <Text size="sm" muted>Used for overview totals. Quick entry remembers the last currency you used.</Text>
        <Segmented<Currency>
          options={[{ value: 'NGN', label: '₦ Naira' }, { value: 'USD', label: '$ US dollar' }]}
          value={settings.default_currency}
          onChange={(v) => void updateSettings({ default_currency: v })}
        />
      </Card>

      <ExchangeRate />

      <Card onPress={() => router.push('/categories')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="shape-outline" color={t.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text weight="bold">Categories</Text>
          <Text size="sm" muted>Add, rename or hide categories</Text>
        </View>
        <Icon name="chevron-right" color={t.colors.textMuted} />
      </Card>

      <Text size="xs" muted style={{ textAlign: 'center' }}>
        Tracking only: this app holds no money. Everything is stored on this phone.
      </Text>
    </Screen>
  );
}

function BucketSplit() {
  const t = useTheme();
  const toast = useToast();
  const { db, changed } = useApp();
  const { data: buckets } = useQuery((d) => listBuckets(d), []);
  const [draft, setDraft] = useState<Record<number, number>>({});
  useEffect(() => {
    if (buckets) setDraft(Object.fromEntries(buckets.map((b) => [b.id, b.percentage])));
  }, [buckets]);

  const values = Object.values(draft);
  const total = values.reduce((a, b) => a + b, 0);
  const dirty = buckets?.some((b) => draft[b.id] !== b.percentage);
  const err = validatePercentages(values);

  async function save() {
    try {
      await setBucketPercentages(db, draft);
      await changed();
      toast('Split saved. It applies to new income only.');
    } catch (e) {
      toast(e instanceof UserError ? e.message : 'Could not save.', 'error');
    }
  }

  const step = (b: Bucket, d: number) =>
    setDraft((cur) => ({ ...cur, [b.id]: Math.min(100, Math.max(0, (cur[b.id] ?? 0) + d)) }));

  return (
    <Card style={{ gap: 12 }}>
      <Text size="lg" weight="bold">Income split</Text>
      <Text size="sm" muted>Every income is split automatically. Changes apply to future income only.</Text>
      {buckets?.map((b) => (
        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: b.colour }} />
          <Text weight="semibold" style={{ flex: 1 }}>{b.name}</Text>
          <Stepper label={`${b.name} percentage`} onPress={() => step(b, -1)} onLongPress={() => step(b, -5)} icon="minus" />
          <Text size="lg" weight="extrabold" tabular style={{ width: 52, textAlign: 'center' }}>{draft[b.id] ?? 0}%</Text>
          <Stepper label={`${b.name} percentage`} onPress={() => step(b, 1)} onLongPress={() => step(b, 5)} icon="plus" />
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.colors.border }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.income }} />
        <Text weight="semibold" style={{ flex: 1 }}>Spendable</Text>
        <Text size="lg" weight="extrabold" tabular color={total > 100 ? t.colors.critical : t.colors.income}>
          {Math.max(100 - total, 0)}%
        </Text>
      </View>
      {err ? <Text size="sm" color={t.colors.critical}>{err}</Text> : null}
      {dirty ? <Button label="Save split" onPress={save} disabled={!!err} /> : null}
    </Card>
  );
}

function Stepper({ icon, label, onPress, onLongPress }: { icon: string; label: string; onPress: () => void; onLongPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'plus' ? 'Increase' : 'Decrease'} ${label}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? t.colors.border : t.colors.track,
      })}
    >
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

function ExchangeRate() {
  const t = useTheme();
  const toast = useToast();
  const { settings, updateSettings, refreshRate } = useApp();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const updated = settings.fx_updated_at ? new Date(settings.fx_updated_at) : null;
  const source =
    settings.fx_source === 'manual' ? 'Set by you'
    : settings.fx_source === 'live' ? `Live rate${updated ? `, updated ${updated.toLocaleDateString()} ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : 'Starting value. Connect to the internet or enter today\'s rate.';

  async function refresh() {
    setBusy(true);
    const r = await refreshRate();
    setBusy(false);
    toast(r === 'updated' ? 'Rate updated' : r === 'offline' ? "You're offline. Using the last known rate." : 'Could not get the rate right now.', r === 'updated' ? 'success' : 'error');
  }

  async function saveManual() {
    const milli = parseRate(input);
    if (!milli) {
      toast('Enter a rate like 1550 or 1550.25.', 'error');
      return;
    }
    await updateSettings({ last_fx_rate: milli, fx_source: 'manual', fx_updated_at: new Date().toISOString() });
    setInput('');
    toast('Rate saved');
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text size="lg" weight="bold">Exchange rate</Text>
      <Text size="3xl" weight="extrabold" tabular>$1 = ₦{formatRate(settings.last_fx_rate)}</Text>
      <Text size="sm" muted>{source}. Each entry keeps the rate from when it was logged.</Text>
      <Button label="Refresh live rate" icon="refresh" variant="secondary" onPress={refresh} busy={busy} />
      <Text weight="semibold" style={{ marginTop: 4 }}>Set it yourself</Text>
      <AmountField value={input} onChange={setInput} prefix="₦" placeholder="Naira per $1" />
      <Button label="Use this rate" onPress={saveManual} disabled={!input} />
      {settings.fx_source === 'manual' ? (
        <Text size="sm" color={t.colors.textMuted}>
          Your rate stays until you refresh the live rate.
        </Text>
      ) : null}
    </Card>
  );
}
