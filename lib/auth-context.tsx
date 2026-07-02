import React, { createContext, useContext, useMemo, useState } from 'react';

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
  signOut: () => void;
  setUserBalance: (balance: number | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    userId: null,
    userToken: null,
    userName: null,
    userMobile: null,
    userBalance: null,
  });
  const [isInitialized, setIsInitialized] = useState(true);

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
          userBalance: null,
        });
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
