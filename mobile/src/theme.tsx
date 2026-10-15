import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme as NavDark,
  DefaultTheme as NavLight,
  type Theme as NavigationTheme,
} from "@react-navigation/native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

export interface Palette {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  primaryText: string;
  danger: string;
  dangerSoft: string;
  success: string;
  inputBg: string;
  chip: string;
  headerBg: string;
}

export const light: Palette = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  cardAlt: "#EEF0F4",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  primary: "#4F46E5",
  primarySoft: "#EEF0FF",
  primaryText: "#FFFFFF",
  danger: "#E11D48",
  dangerSoft: "#FEECEF",
  success: "#059669",
  inputBg: "#FFFFFF",
  chip: "#E9ECF2",
  headerBg: "#FFFFFF",
};

export const dark: Palette = {
  bg: "#0B0F1A",
  card: "#151A26",
  cardAlt: "#1B2130",
  text: "#E8EAF0",
  textMuted: "#8B93A7",
  border: "#262D3D",
  primary: "#6366F1",
  primarySoft: "#1E2440",
  primaryText: "#FFFFFF",
  danger: "#FB7185",
  dangerSoft: "#2A1720",
  success: "#34D399",
  inputBg: "#1B2130",
  chip: "#202838",
  headerBg: "#10151F",
};

export const radius = { sm: 8, md: 12, lg: 16 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export type ThemeMode = "system" | "light" | "dark";
const STORAGE_KEY = "themeMode";

interface ThemeContextValue {
  isDark: boolean;
  c: Palette;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // "light" | "dark" | null
  const [mode, setModeState] = useState<ThemeMode>("system");

  // carrega a preferencia salva
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
    });
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  }

  const isDark = mode === "system" ? system === "dark" : mode === "dark";

  const value = useMemo<ThemeContextValue>(
    () => ({ isDark, c: isDark ? dark : light, mode, setMode }),
    [isDark, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}

export function navTheme(isDark: boolean): NavigationTheme {
  const c = isDark ? dark : light;
  const base = isDark ? NavDark : NavLight;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.bg,
      card: c.headerBg,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
  };
}
