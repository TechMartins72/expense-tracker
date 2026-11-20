import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './ui';

/** Bottom sheet for small focused tasks (mark a bucket done, set a budget). */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: t.colors.scrim }} />
        <View
          style={{
            backgroundColor: t.colors.surfaceRaised,
            borderTopLeftRadius: t.radius.hero,
            borderTopRightRadius: t.radius.hero,
            padding: 20,
            paddingBottom: 20 + insets.bottom,
            gap: 14,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border }} />
          <Text size="xl" weight="bold">{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function AmountField({
  value,
  onChange,
  prefix,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  prefix: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: t.colors.border,
        borderRadius: t.radius.lg,
        paddingHorizontal: 14,
        backgroundColor: t.colors.surface,
      }}
    >
      <Text size="xl" weight="bold" muted>{prefix}</Text>
      <TextInput
        value={value}
        onChangeText={(s) => onChange(s.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder={placeholder ?? '0'}
        placeholderTextColor={t.colors.textMuted}
        autoFocus={autoFocus}
        style={{ flex: 1, fontFamily: t.fonts.bold, fontSize: t.size.xl, color: t.colors.text, paddingVertical: 12, paddingLeft: 6 }}
      />
    </View>
  );
}
