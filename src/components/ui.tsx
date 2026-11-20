import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import type { TextSize } from '../theme/tokens';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color }: { name: string; size?: number; color?: string }) {
  const t = useTheme();
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color ?? t.colors.text} />;
}

type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

export function Text({
  size = 'base',
  weight = 'regular',
  muted,
  color,
  tabular,
  style,
  ...rest
}: TextProps & { size?: TextSize; weight?: Weight; muted?: boolean; color?: string; tabular?: boolean }) {
  const t = useTheme();
  const s: TextStyle = {
    fontFamily: t.fonts[weight],
    fontSize: t.size[size],
    lineHeight: Math.round(t.size[size] * 1.35),
    color: color ?? (muted ? t.colors.textMuted : t.colors.text),
    fontVariant: tabular ? ['tabular-nums'] : undefined,
  };
  return <RNText {...rest} style={[s, style]} />;
}

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const pad = { padding: t.space.lg, paddingBottom: 120, gap: t.space.lg };
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.colors.surface }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, contentStyle]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text size="sm" muted weight="medium">{subtitle}</Text> : null}
        <Text size="3xl" weight="extrabold">{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.space.lg,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.space.sm }}>
      <Text size="xl" weight="bold">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text size="sm" weight="semibold" color={t.colors.primary}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  busy,
  color,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: string;
  disabled?: boolean;
  busy?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? color ?? t.colors.primary
    : variant === 'danger' ? t.colors.criticalBg
    : variant === 'secondary' ? t.colors.surfaceRaised
    : 'transparent';
  const fg =
    variant === 'primary' ? t.colors.onPrimary
    : variant === 'danger' ? t.colors.critical
    : variant === 'secondary' ? t.colors.text
    : t.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: t.radius.lg,
          paddingHorizontal: 20,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: t.colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text weight="bold" color={fg}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
  color,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const t = useTheme();
  const accent = color ?? t.colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        minHeight: 40,
        borderRadius: t.radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? accent : t.colors.border,
        backgroundColor: selected ? accent : t.colors.surfaceRaised,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={18} color={selected ? '#fff' : accent} /> : null}
      <Text size="sm" weight="semibold" color={selected ? '#fff' : t.colors.text}>{label}</Text>
    </Pressable>
  );
}

/** Two- or three-way pill switch (Expense/Income, NGN/USD). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  colors,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  colors?: Partial<Record<T, string>>;
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.scheme === 'dark' ? t.colors.frame : t.colors.track,
        borderRadius: t.radius.pill,
        padding: 4,
        alignSelf: compact ? 'flex-start' : 'stretch',
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) void Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={{
              flex: compact ? undefined : 1,
              paddingHorizontal: compact ? 14 : 8,
              minHeight: compact ? 32 : 40,
              borderRadius: t.radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? colors?.[o.value] ?? t.colors.surfaceRaised : 'transparent',
            }}
          >
            <Text
              size={compact ? 'xs' : 'sm'}
              weight="bold"
              color={on ? (colors?.[o.value] ? '#fff' : t.colors.text) : t.colors.textMuted}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const t = useTheme();
  const pct = max <= 0 ? (value > 0 ? 1 : 0) : Math.min(value / max, 1);
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: t.colors.track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 5, backgroundColor: color }} />
    </View>
  );
}

export function IconBadge({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: string; title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
      <Icon name={icon} size={36} color={t.colors.textMuted} />
      <Text weight="bold">{title}</Text>
      {body ? <Text size="sm" muted style={{ textAlign: 'center' }}>{body}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
