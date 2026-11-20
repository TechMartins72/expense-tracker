import { Michroma_400Regular } from '@expo-google-fonts/michroma';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getSettings, type Settings } from '../db/repo';
import { migrate } from '../db/schema';
import { AppStateProvider, useApp } from '../state/AppState';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { ToastProvider } from '../components/toast';

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f5fc' }}>
      <ActivityIndicator color="#0935d1" />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Michroma_400Regular,
  });
  if (!fontsLoaded) return <Loading />;
  return (
    <SafeAreaProvider>
      <Suspense fallback={<Loading />}>
        <SQLiteProvider databaseName="expenses.db" onInit={migrate} useSuspense>
          <WithSettings />
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

function WithSettings() {
  const db = useSQLiteContext();
  const [initial, setInitial] = useState<Settings>();
  useEffect(() => {
    getSettings(db).then(setInitial);
  }, [db]);
  if (!initial) return <Loading />;
  return (
    <AppStateProvider initial={initial}>
      <Themed />
    </AppStateProvider>
  );
}

function Themed() {
  const { settings } = useApp();
  return (
    <ThemeProvider preference={settings.theme}>
      <ToastProvider>
        <Navigator />
      </ToastProvider>
    </ThemeProvider>
  );
}

function Navigator() {
  const t = useTheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.colors.surface);
  }, [t.colors.surface]);
  return (
    <>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.colors.surface },
          animation: 'slide_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="entry" options={{ presentation: 'modal' }} />
        <Stack.Screen name="review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="categories" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
