import { Pressable, View } from 'react-native';
import type { TxnRow } from '../db/repo';
import { dayLabel } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { useTheme } from '../theme/ThemeProvider';
import { IconBadge, Text } from './ui';

export function TxnItem({ txn, onPress, showDate = true }: { txn: TxnRow; onPress?: () => void; showDate?: boolean }) {
  const t = useTheme();
  const income = txn.type === 'income';
  const sub = [showDate ? dayLabel(txn.date) : null, txn.note].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${txn.category_name}, ${income ? 'income' : 'expense'} ${formatMoney(txn.amount, txn.currency)}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <IconBadge icon={txn.category_icon} color={txn.category_colour} />
      <View style={{ flex: 1 }}>
        <Text weight="semibold" numberOfLines={1}>{txn.category_name}</Text>
        {sub ? <Text size="sm" muted numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Text weight="bold" tabular color={income ? t.colors.income : t.colors.expense}>
        {formatMoney(income ? txn.amount : -txn.amount, txn.currency, { sign: income })}
      </Text>
    </Pressable>
  );
}
