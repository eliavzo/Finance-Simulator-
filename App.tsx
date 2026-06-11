/**
 * App entry point — "Alpha & Carry", a newspaper-styled fund-management sim.
 *
 * Loads the serif fonts, hydrates persistence, shows the front page (start
 * screen) and the five-section navigation (Übersicht / Markt / Firma / Fonds /
 * Risiko) styled like a broadsheet.
 */
import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useSimStore } from './src/sim/store';
import { useTr } from './src/i18n';
import { useNewspaperFonts } from './src/utils/fonts';
import { Loading } from './src/components/ui';
import { SimStartScreen } from './src/sim/screens/SimStartScreen';
import { SimDashboardScreen } from './src/sim/screens/SimDashboardScreen';
import { MarketsScreen } from './src/sim/screens/MarketsScreen';
import { FirmScreen } from './src/sim/screens/FirmScreen';
import { FundScreen } from './src/sim/screens/FundScreen';
import { StartupsScreen } from './src/sim/screens/StartupsScreen';
import { RiskScreen } from './src/sim/screens/RiskScreen';
import { MonthReportModal } from './src/sim/screens/MonthReportModal';
import { DecisionModal } from './src/sim/screens/DecisionModal';
import { OpportunityModal } from './src/sim/screens/OpportunityModal';
import { EndGameModal } from './src/sim/screens/EndGameModal';
import { OnboardingModal } from './src/components/OnboardingModal';
import { ManualModal } from './src/components/ManualModal';
import { AnalysisModal } from './src/sim/screens/AnalysisModal';
import { ArchiveModal } from './src/components/ArchiveModal';
import { colors, fonts } from './src/utils/theme';

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

function TabGlyph({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontFamily: fonts.display, fontSize: 19, color }}>{glyph}</Text>;
}

export default function App() {
  const t = useTr();
  const fontsReady = useNewspaperFonts();
  const hydrated = useSimStore((s) => s.hydrated);
  const game = useSimStore((s) => s.game);

  if (!fontsReady || !hydrated) {
    return (
      <SafeAreaProvider>
        <Loading label={t({ de: 'Die Ausgabe wird gesetzt …', en: 'Setting the edition …' })} />
        <StatusBar style="dark" />
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
                tabBarStyle: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, height: 60, paddingBottom: 6, paddingTop: 6 },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: { fontFamily: fonts.serifBold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
              }}
            >
              <Tab.Screen name="Übersicht" component={SimDashboardScreen} options={{ tabBarLabel: t({ de: 'Übersicht', en: 'Overview' }), tabBarIcon: ({ color }) => <TabGlyph glyph="§" color={color} /> }} />
              <Tab.Screen name="Markt" component={MarketsScreen} options={{ tabBarLabel: t({ de: 'Markt', en: 'Markets' }), tabBarIcon: ({ color }) => <TabGlyph glyph="$" color={color} /> }} />
              <Tab.Screen name="Firma" component={FirmScreen} options={{ tabBarLabel: t({ de: 'Firma', en: 'Firm' }), tabBarIcon: ({ color }) => <TabGlyph glyph="¶" color={color} /> }} />
              <Tab.Screen name="Fonds" component={FundScreen} options={{ tabBarLabel: t({ de: 'Fonds', en: 'Fund' }), tabBarIcon: ({ color }) => <TabGlyph glyph="‡" color={color} /> }} />
              <Tab.Screen name="Startups" component={StartupsScreen} options={{ tabBarLabel: t({ de: 'Startups', en: 'Startups' }), tabBarIcon: ({ color }) => <TabGlyph glyph="◇" color={color} /> }} />
              <Tab.Screen name="Risiko" component={RiskScreen} options={{ tabBarLabel: t({ de: 'Risiko', en: 'Risk' }), tabBarIcon: ({ color }) => <TabGlyph glyph="†" color={color} /> }} />
            </Tab.Navigator>
            <MonthReportModal />
            <DecisionModal />
            <OpportunityModal />
            <EndGameModal />
            <OnboardingModal />
            <ManualModal />
            <AnalysisModal />
            <ArchiveModal />
          </NavigationContainer>
        )}
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
