import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './ui';

export function Fab() {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add an expense or income"
      onPress={() => router.push('/entry')}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: t.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Icon name="plus" size={32} color="#fff" />
    </Pressable>
  );
}
