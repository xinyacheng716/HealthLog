import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermission, ensureAnticoagulantReminder, ensureAnticoagulantEveningReminder } from './src/lib/notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import RecordScreen from './src/screens/RecordScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import DailyMedScreen from './src/screens/DailyMedScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { AppProviders } from './src/context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ViewerProvider, useViewer } from './src/context/ViewerContext';
import { colors, headerShadow } from './src/constants/colors';

// 前景時仍顯示通知 banner（需在任何 component render 前設定）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();

const KAITI = Platform.OS === 'ios' ? 'STKaiti' : 'serif';
const FONT = { fontFamily: KAITI };

// Tab config: Chinese single-character icons, traditional
const TABS = [
  { name: '記錄症狀', char: '記', idx: 0 },
  { name: '歷史紀錄', char: '史', idx: 1 },
  { name: '行事曆',   char: '曆', idx: 2 },
  { name: '每日用藥', char: '藥', idx: 3 },
  { name: '設定',    char: '設', idx: 4 },
];

// Tab icon: a calligraphic Chinese character in a small seal-square,
// always shown in the bright gold look; the focused tab is emphasized further
function TabIcon({ char, focused }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={[styles.tabIconChar, FONT, focused && styles.tabIconCharFocused]}>
        {char}
      </Text>
    </View>
  );
}

function AppHeader({ title }) {
  const insets = useSafeAreaInsets();
  const today = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <LinearGradient
      colors={[colors.headerDeep, colors.header, colors.headerMid]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 12 }, headerShadow]}
    >
      {/* Top gold rule */}
      <View style={styles.topRuleRow}>
        <View style={styles.topRuleThin} />
        <View style={styles.topRuleDot} />
        <View style={styles.topRuleThin} />
      </View>

      {/* Book title row */}
      <View style={styles.titleRow}>
        {/* Left vertical text label */}
        <View style={styles.sideLabel}>
          <Text style={[styles.sideLabelChar, FONT]}>健</Text>
          <Text style={[styles.sideLabelChar, FONT]}>康</Text>
          <Text style={[styles.sideLabelChar, FONT]}>記</Text>
          <Text style={[styles.sideLabelChar, FONT]}>錄</Text>
        </View>

        {/* Center divider */}
        <View style={styles.sideDivider} />

        {/* Main title */}
        <View style={styles.titleMain}>
          <Text style={[styles.headerTitle, FONT]}>{title}</Text>
          <Text style={[styles.headerDate, FONT]}>{today}</Text>
        </View>
      </View>

      {/* Bottom gold rule */}
      <View style={styles.bottomRuleRow}>
        <View style={styles.bottomRuleLine} />
        <View style={styles.bottomRuleDiamond}>
          <View style={styles.diamond} />
        </View>
        <View style={styles.bottomRuleLine} />
      </View>
    </LinearGradient>
  );
}

function IdentitySwitcher() {
  const { viewableOwners, activeOwner, setActiveOwner } = useViewer();
  if (viewableOwners.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.switcherBar}
      contentContainerStyle={styles.switcherContent}
    >
      <TouchableOpacity
        style={[styles.switcherChip, activeOwner === null && styles.switcherChipActive]}
        onPress={() => setActiveOwner(null)}
        activeOpacity={0.7}
      >
        <Text style={[styles.switcherChipText, FONT, activeOwner === null && styles.switcherChipTextActive]}>
          查看自己
        </Text>
      </TouchableOpacity>
      {viewableOwners.map((owner) => (
        <TouchableOpacity
          key={owner.id}
          style={[styles.switcherChip, activeOwner?.id === owner.id && styles.switcherChipActive]}
          onPress={() => setActiveOwner(owner)}
          activeOpacity={0.7}
        >
          <Text style={[styles.switcherChipText, FONT, activeOwner?.id === owner.id && styles.switcherChipTextActive]}>
            {owner.full_name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function makeScreen(Screen, tabIdx) {
  return function WrappedScreen() {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader title={TABS[tabIdx].name} />
        <IdentitySwitcher />
        <Screen />
      </View>
    );
  };
}

function AppContent() {
  const { session, isLoading } = useAuth();

  // 登入後請求通知授權，並確保抗凝血每日提醒（早晚各一筆）已排程
  useEffect(() => {
    if (!session) return;
    requestNotificationPermission().then((granted) => {
      if (granted) {
        ensureAnticoagulantReminder();
        ensureAnticoagulantEveningReminder();
      }
    });
  }, [session?.user?.id]);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.header }} />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => {
          const tab = TABS.find((t) => t.name === route.name);
          return {
            headerShown: false,
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: colors.goldLight,
            tabBarInactiveTintColor: colors.goldLight,
            tabBarLabelStyle: [styles.tabLabel, FONT],
            tabBarIcon: ({ focused }) => (
              <TabIcon char={tab?.char || '?'} focused={focused} />
            ),
          };
        }}
      >
        {TABS.map((tab) => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={makeScreen(
              [RecordScreen, HistoryScreen, CalendarScreen, DailyMedScreen, SettingsScreen][tab.idx],
              tab.idx,
            )}
          />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ViewerProvider>
          <AppProviders>
            <StatusBar style="light" />
            <AppContent />
          </AppProviders>
        </ViewerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingBottom: 14,
    paddingHorizontal: 20,
  },

  topRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 5,
  },
  topRuleThin: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.45,
  },
  topRuleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.goldLight,
    opacity: 0.7,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },

  sideLabel: {
    alignItems: 'center',
    gap: 1,
    flexShrink: 0,
  },
  sideLabelChar: {
    color: colors.goldFaint,
    fontSize: 9,
    letterSpacing: 1,
    opacity: 0.65,
    lineHeight: 13,
  },

  sideDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.gold,
    opacity: 0.35,
    flexShrink: 0,
  },

  titleMain: {
    flex: 1,
    gap: 3,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 22,
    letterSpacing: 4,
  },
  headerDate: {
    color: colors.goldFaint,
    fontSize: 10,
    letterSpacing: 1,
    opacity: 0.75,
  },

  bottomRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bottomRuleLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.gold,
    opacity: 0.5,
  },
  bottomRuleDiamond: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
    opacity: 0.8,
  },

  // ── Identity Switcher ────────────────────────────────────────────────────
  switcherBar: {
    backgroundColor: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
    flexGrow: 0,
  },
  switcherContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  switcherChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(154,120,56,0.4)',
    backgroundColor: 'rgba(154,120,56,0.08)',
  },
  switcherChipActive: {
    backgroundColor: colors.cinnabar,
    borderColor: colors.cinnabar,
  },
  switcherChipText: {
    fontSize: 12,
    color: colors.goldFaint,
    letterSpacing: 1.5,
  },
  switcherChipTextActive: {
    color: colors.white,
  },

  // ── Tab Bar ─────────────────────────────────────────────────────────────
  tabBar: {
    backgroundColor: colors.headerDeep,
    borderTopWidth: 0,
    height: 84,
    paddingBottom: 12,
    paddingTop: 8,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.25,
    shadowRadius: 0,
    elevation: 12,
  },
  tabLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: 10,
    fontWeight: '600',
  },

  // ── Tab Icon ─────────────────────────────────────────────────────────────
  tabIcon: {
    width: 40,
    height: 40,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(196,160,88,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196,160,88,0.16)',
    marginBottom: 2,
  },
  tabIconFocused: {
    borderWidth: 1.5,
    borderColor: colors.goldLight,
    backgroundColor: 'rgba(196,160,88,0.35)',
  },
  tabIconChar: {
    fontSize: 20,
    color: colors.goldLight,
    lineHeight: 25,
  },
  tabIconCharFocused: {
    fontWeight: '700',
  },
});
