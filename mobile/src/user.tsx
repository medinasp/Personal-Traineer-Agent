import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "userName";

interface UserContextValue {
  name: string;
  setName: (v: string) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v != null) setNameState(v);
    });
  }, []);

  function setName(v: string) {
    setNameState(v);
    AsyncStorage.setItem(STORAGE_KEY, v);
  }

  return <UserContext.Provider value={{ name, setName }}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser deve ser usado dentro de <UserProvider>");
  return ctx;
}
