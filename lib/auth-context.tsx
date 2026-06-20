import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type AuthSession = {
  userId: string | null;
  userToken: string | null;
  userName: string | null;
  userMobile: string | null;
};

type AuthContextValue = AuthSession & {
  isAuthenticated: boolean;
  isInitialized: boolean;
  signIn: (session: Partial<AuthSession>) => void;
  signOut: () => void;
};

const LEGACY_AUTH_KEYS = ['userId', 'userToken', 'userName', 'userMobile'];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    userId: null,
    userToken: null,
    userName: null,
    userMobile: null,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const clearLegacyStorage = async () => {
      try {
        await AsyncStorage.multiRemove(LEGACY_AUTH_KEYS);
      } catch (error) {
        console.log('[Auth] failed to clear legacy storage', error);
      } finally {
        setIsInitialized(true);
      }
    };

    clearLegacyStorage();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      isInitialized,
      isAuthenticated: Boolean(session.userId && session.userToken),
      signIn: (nextSession) => {
        setSession((prev) => ({
          ...prev,
          ...nextSession,
        }));
      },
      signOut: () => {
        setSession({
          userId: null,
          userToken: null,
          userName: null,
          userMobile: null,
        });
      },
    }),
    [session, isInitialized]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
