/**
 * App entry point — "Alpha & Carry" v2 fund-management simulation.
 *
 * Wires persistence hydration, the start screen, and the five-tab navigation
 * (Übersicht / Markt / Firma / Fonds / Risiko).
 */
import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useSimStore } from './src/sim/store';
import { Loading } from './src/components/ui';
import { SimStartScreen } from './src/sim/screens/SimStartScreen';
import { SimDashboardScreen } from './src/sim/screens/SimDashboardScreen';
import { MarketsScreen } from './src/sim/screens/MarketsScreen';
import { FirmScreen } from './src/sim/screens/FirmScreen';
import { FundScreen } from './src/sim/screens/FundScreen';
import { RiskScreen } from './src/sim/screens/RiskScreen';
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
  return <Text style={{ fontSize: 18, color }}>{icon}</Text>;
}

export default function App() {
  const hydrated = useSimStore((s) => s.hydrated);
  const game = useSimStore((s) => s.game);

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
          <SimStartScreen />
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
              <Tab.Screen name="Übersicht" component={SimDashboardScreen} options={{ tabBarIcon: ({ color }) => <TabIcon icon="◎" color={color} /> }} />
              <Tab.Screen name="Markt" component={MarketsScreen} options={{ tabBarIcon: ({ color }) => <TabIcon icon="📈" color={color} /> }} />
              <Tab.Screen name="Firma" component={FirmScreen} options={{ tabBarIcon: ({ color }) => <TabIcon icon="🏢" color={color} /> }} />
              <Tab.Screen name="Fonds" component={FundScreen} options={{ tabBarIcon: ({ color }) => <TabIcon icon="💼" color={color} /> }} />
              <Tab.Screen name="Risiko" component={RiskScreen} options={{ tabBarIcon: ({ color }) => <TabIcon icon="⚠️" color={color} /> }} />
            </Tab.Navigator>
          </NavigationContainer>
        )}
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
