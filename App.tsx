/**
 * App entry point. Wires up persistence hydration, the start screen, and the
 * four-tab navigation (Dashboard / Hedge Fund / VC / Übersicht).
 */
import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useGameStore } from './src/store/gameStore';
import { Loading } from './src/components/ui';
import { StartScreen } from './src/screens/StartScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { HedgeFundScreen } from './src/screens/HedgeFundScreen';
import { VCPortfolioScreen } from './src/screens/VCPortfolioScreen';
import { ChartScreen } from './src/screens/ChartScreen';
import { colors } from './src/utils/theme';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    border: colors.border,
    text: colors.text,
    primary: colors.primary,
  },
};

function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function App() {
  const hydrated = useGameStore((s) => s.hydrated);
  const game = useGameStore((s) => s.game);

  if (!hydrated) {
    return (
      <SafeAreaProvider>
        <Loading label="Lade Spielstand…" />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        {!game || !game.started ? (
          <StartScreen />
        ) : (
          <NavigationContainer theme={navTheme}>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
              }}
            >
              <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{ tabBarIcon: ({ color }) => <TabIcon icon="◎" color={color} /> }}
              />
              <Tab.Screen
                name="Hedge Fund"
                component={HedgeFundScreen}
                options={{ tabBarIcon: ({ color }) => <TabIcon icon="📈" color={color} /> }}
              />
              <Tab.Screen
                name="VC"
                component={VCPortfolioScreen}
                options={{ tabBarIcon: ({ color }) => <TabIcon icon="🚀" color={color} /> }}
              />
              <Tab.Screen
                name="Übersicht"
                component={ChartScreen}
                options={{ tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }}
              />
            </Tab.Navigator>
          </NavigationContainer>
        )}
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
