import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast';
import { Button, Card, Header, Icon, IconBadge, Screen, Segmented, Text } from '../components/ui';
import { listCategories, saveCategory, setCategoryArchived, UserError, type Category, type Kind } from '../db/repo';
import { useApp, useQuery } from '../state/AppState';
import { useTheme } from '../theme/ThemeProvider';

const ICONS = [
  'food-outline', 'cart-outline', 'bus', 'car', 'motorbike', 'gas-station-outline', 'cellphone-wireless', 'wifi',
  'lightning-bolt-outline', 'water-outline', 'home-outline', 'account-outline', 'tshirt-crew-outline', 'medical-bag',
  'school-outline', 'hand-heart-outline', 'gift-outline', 'briefcase-outline', 'storefront-outline', 'cash',
  'airplane', 'movie-outline', 'dumbbell', 'baby-face-outline', 'paw', 'dots-horizontal',
];
const COLOURS = ['#0935d1', '#0089ff', '#7c4dff', '#0e9f6e', '#14b8a6', '#f59e0b', '#eab308', '#e0564b', '#ec4899', '#64748b'];

export default function Categories() {
  const t = useTheme();
  const { db, changed } = useApp();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('expense');
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const { data: cats } = useQuery(async (d) => (await listCategories(d, kind, true)).sort((a, b) => a.archived - b.archived || a.sort_order - b.sort_order), [kind]);

  async function toggle(c: Category) {
    await setCategoryArchived(db, c.id, !c.archived);
    await changed();
    toast(c.archived ? `${c.name} is back in quick entry` : `${c.name} hidden. Past entries keep it.`, 'info');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="chevron-left" color={t.colors.primary} />
        <Text weight="semibold" color={t.colors.primary}>Settings</Text>
      </Pressable>
      <Header title="Categories" right={<Button label="Add" icon="plus" onPress={() => setEditing({ kind })} style={{ minHeight: 44 }} />} />
      <Segmented<Kind> options={[{ value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} value={kind} onChange={setKind} />
      <Card style={{ paddingVertical: 4 }}>
        {cats?.map((c, i) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.colors.border, opacity: c.archived ? 0.5 : 1 }}>
            <IconBadge icon={c.icon} color={c.colour} size={36} />
            <Pressable style={{ flex: 1 }} onPress={() => setEditing(c)}>
              <Text weight="semibold">{c.name}</Text>
              <Text size="xs" muted>{c.archived ? 'Hidden' : `Used ${c.usage_count} time${c.usage_count === 1 ? '' : 's'}`}</Text>
            </Pressable>
            <Pressable accessibilityLabel={c.archived ? `Show ${c.name}` : `Hide ${c.name}`} onPress={() => toggle(c)} hitSlop={8} style={{ padding: 6 }}>
              <Icon name={c.archived ? 'eye-off-outline' : 'eye-outline'} color={t.colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </Card>
      <EditSheet editing={editing} onClose={() => setEditing(null)} onSaved={changed} />
    </Screen>
  );
}

function EditSheet({ editing, onClose, onSaved }: { editing: Partial<Category> | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = useTheme();
  const { db } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [colour, setColour] = useState(COLOURS[0]);
  useEffect(() => {
    if (!editing) return;
    setName(editing.name ?? '');
    setIcon(editing.icon ?? ICONS[0]);
    setColour(editing.colour ?? COLOURS[0]);
  }, [editing]);

  async function save() {
    if (!editing?.kind) return;
    try {
      await saveCategory(db, { id: editing.id, name, icon, colour, kind: editing.kind });
      await onSaved();
      toast('Category saved');
      onClose();
    } catch (e) {
      toast(e instanceof UserError ? e.message : 'Could not save.', 'error');
    }
  }

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing?.id ? 'Edit category' : 'New category'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge icon={icon} color={colour} size={48} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={t.colors.textMuted}
          maxLength={24}
          style={{ flex: 1, fontFamily: t.fonts.semibold, fontSize: t.size.lg, color: t.colors.text, borderBottomWidth: 1.5, borderBottomColor: t.colors.border, paddingVertical: 8 }}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {COLOURS.map((c) => (
          <Pressable key={c} accessibilityLabel={`Colour ${c}`} onPress={() => setColour(c)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: c === colour ? t.colors.text : 'transparent' }} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {ICONS.map((i) => (
          <Pressable key={i} accessibilityLabel={i} onPress={() => setIcon(i)} style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i === icon ? colour + '33' : 'transparent' }}>
            <Icon name={i} color={i === icon ? colour : t.colors.textMuted} />
          </Pressable>
        ))}
      </View>
      <Button label="Save" onPress={save} disabled={!name.trim()} />
    </Sheet>
  );
}
