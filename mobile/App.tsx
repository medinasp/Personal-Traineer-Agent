import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getDb } from "./src/db";
import { OfflineSync } from "./src/offline/OfflineSync";
import { qc } from "./src/queryClient";

import { TodayStack } from "./src/navigation/TodayStack";
import type { RootTabParamList } from "./src/navigation/types";
import { WorkoutsStack } from "./src/navigation/WorkoutsStack";
import { ChatScreen } from "./src/screens/ChatScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { RestTimerProvider } from "./src/restTimer";
import { ThemeProvider, navTheme, useTheme } from "./src/theme";
import { UserProvider } from "./src/user";

const Tab = createBottomTabNavigator<RootTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;
const TAB_ICONS: Record<string, IconName> = {
  Inicio: "home",
  Treinos: "barbell",
  HojeTab: "today",
  Coach: "sparkles",
  Ajustes: "settings-outline",
};

function Tabs() {
  const { c } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarHideOnKeyboard: true, // libera o campo quando o teclado abre (ex.: Coach)
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name] ?? "ellipse"} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{ title: "Início", headerShown: false }}
      />
      <Tab.Screen
        name="Treinos"
        component={WorkoutsStack}
        options={{ title: "Treinos", headerShown: false }}
      />
      <Tab.Screen
        name="HojeTab"
        component={TodayStack}
        options={{ title: "Diário", headerShown: false }}
      />
      <Tab.Screen name="Coach" component={ChatScreen} options={{ title: "Coach" }} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} options={{ title: "Ajustes" }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { isDark } = useTheme();
  return (
    <NavigationContainer theme={navTheme(isDark)}>
      <Tabs />
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    void getDb(); // abre/migra o SQLite no start
  }, []);
  return (
    <ThemeProvider>
      <UserProvider>
        <RestTimerProvider>
          <QueryClientProvider client={qc}>
            <SafeAreaProvider>
              <OfflineSync />
              <Root />
            </SafeAreaProvider>
          </QueryClientProvider>
        </RestTimerProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
