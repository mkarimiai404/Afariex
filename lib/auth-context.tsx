import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { registerAuthExpiryHandler } from '@/lib/api';

const AUTH_STORAGE_KEY = 'afariex_auth_session';
const LEGACY_AUTH_KEYS = ['api_token', 'userToken', 'user_token', 'user_id', 'userId'] as const;

type AuthSession = {
  userId: string | null;
  userToken: string | null;
  userName: string | null;
  userMobile: string | null;
  userBalance: number | null;
};

type AuthContextValue = AuthSession & {
  isAuthenticated: boolean;
  isInitialized: boolean;
  signIn: (session: Partial<AuthSession>) => void;
  signOut: () => Promise<void>;
  setUserBalance: (balance: number | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const emptySession = (): AuthSession => ({
  userId: null,
  userToken: null,
  userName: null,
  userMobile: null,
  userBalance: null,
});

const clearStoredAuth = async () => {
  const results = await Promise.allSettled([
    AsyncStorage.removeItem(AUTH_STORAGE_KEY),
    ...LEGACY_AUTH_KEYS.map((key) => AsyncStorage.removeItem(key)),
  ]);
  if (__DEV__) console.log('[Auth] logout storage cleanup', { success: results.every((result) => result.status === 'fulfilled') });
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    userId: null,
    userToken: null,
    userName: null,
    userMobile: null,
    userBalance: null,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let active = true;
    if (__DEV__) console.log('[Auth] hydration started');
    Promise.all([
      AsyncStorage.getItem(AUTH_STORAGE_KEY),
      AsyncStorage.getItem('api_token'),
      AsyncStorage.getItem('userToken'),
      AsyncStorage.getItem('user_token'),
      AsyncStorage.getItem('user_id'),
      AsyncStorage.getItem('userId'),
    ])
      .then(async ([stored, legacyApiToken, legacyUserToken, legacyUserTokenAlt, legacyUserId, legacyUserIdAlt]) => {
        if (!active) return;
        try {
          const parsed = stored ? JSON.parse(stored) as Partial<AuthSession> : {};
          const canonicalToken = typeof parsed.userToken === 'string' ? parsed.userToken.trim() : '';
          const legacyToken = legacyApiToken || legacyUserToken || legacyUserTokenAlt;
          const legacyId = legacyUserId || legacyUserIdAlt;
          const nextSession: AuthSession = {
            ...emptySession(),
            ...parsed,
            userToken: canonicalToken || legacyToken?.trim() || null,
            userId: parsed.userId || legacyId || null,
          };
          if (!nextSession.userToken) {
            await clearStoredAuth();
          } else {
            if (!canonicalToken || legacyToken) {
              await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
            }
            if (legacyToken || legacyId) {
              await Promise.all(LEGACY_AUTH_KEYS.map((key) => AsyncStorage.removeItem(key)));
            }
          }
          if (active) setSession(nextSession);
        } catch {
          await clearStoredAuth();
          if (active) setSession(emptySession());
        }
      })
      .catch(async () => {
        await clearStoredAuth();
        if (active) setSession(emptySession());
      })
      .finally(() => {
        if (active) {
          setIsInitialized(true);
          if (__DEV__) console.log('[Auth] hydration completed');
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => registerAuthExpiryHandler(async () => {
    setSession(emptySession());
    await clearStoredAuth();
  }), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      isInitialized,
      isAuthenticated: Boolean(session.userToken?.trim()),
      signIn: (nextSession) => {
        setSession((prev) => {
          const token = typeof nextSession.userToken === 'string' ? nextSession.userToken.trim() : '';
          const next = {
            ...prev,
            ...nextSession,
            userToken: token || null,
          };
          if (token) {
            AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
          } else {
            clearStoredAuth().catch(() => undefined);
          }
          return next;
        });
      },
      signOut: async () => {
        setSession(emptySession());
        await clearStoredAuth();
      },
      setUserBalance: (balance) => {
        setSession((prev) => ({
          ...prev,
          userBalance: balance,
        }));
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
