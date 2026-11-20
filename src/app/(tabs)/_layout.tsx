import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

const TABS: { name: string; title: string; icon: string; iconOn: string }[] = [
  { name: 'index', title: 'Overview', icon: 'home-outline', iconOn: 'home' },
  { name: 'transactions', title: 'Activity', icon: 'format-list-bulleted', iconOn: 'format-list-bulleted' },
  { name: 'buckets', title: 'Buckets', icon: 'tray-full', iconOn: 'tray-full' },
  { name: 'budgets', title: 'Budgets', icon: 'chart-donut', iconOn: 'chart-donut' },
  { name: 'settings', title: 'Settings', icon: 'cog-outline', iconOn: 'cog' },
];

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Stow's bottom bar: dark frame with a bright active tab.
        tabBarStyle: {
          backgroundColor: t.colors.frame,
          borderTopWidth: 0,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        tabBarActiveTintColor: t.scheme === 'dark' ? '#6b92ff' : '#4d8dff',
        tabBarInactiveTintColor: t.colors.frameMuted,
        tabBarLabelStyle: { fontFamily: t.fonts.semibold, fontSize: 12 },
        sceneStyle: { backgroundColor: t.colors.surface },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? tab.iconOn : tab.icon} color={String(color)} size={24} />,
          }}
        />
      ))}
    </Tabs>
  );
}
