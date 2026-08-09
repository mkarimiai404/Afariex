import { Slot, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import Toast from 'react-native-toast-message';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { applyGlobalFont, PROJECT_FONT_FAMILIES } from '@/lib/apply-global-font';
import { toastConfig } from '@/lib/toast';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const projectFonts = {
  [PROJECT_FONT_FAMILIES.regular]: require('../assets/fonts/Vazirmatn-Regular.ttf'),
  [PROJECT_FONT_FAMILIES.medium]: require('../assets/fonts/Vazirmatn-Medium.ttf'),
  [PROJECT_FONT_FAMILIES.semiBold]: require('../assets/fonts/Vazirmatn-SemiBold.ttf'),
  [PROJECT_FONT_FAMILIES.bold]: require('../assets/fonts/Vazirmatn-Bold.ttf'),
  [PROJECT_FONT_FAMILIES.extraBold]: require('../assets/fonts/Vazirmatn-ExtraBold.ttf'),
  [PROJECT_FONT_FAMILIES.black]: require('../assets/fonts/Vazirmatn-Black.ttf'),
  [PROJECT_FONT_FAMILIES.light]: require('../assets/fonts/Vazirmatn-Light.ttf'),
  [PROJECT_FONT_FAMILIES.extraLight]: require('../assets/fonts/Vazirmatn-ExtraLight.ttf'),
  [PROJECT_FONT_FAMILIES.thin]: require('../assets/fonts/Vazirmatn-Thin.ttf'),
};

function AuthRouteBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isInitialized } = useAuth();
  const route = segments[0] as string | undefined;
  const publicRoute = route === 'login' || route === 'register';
  const redirectingToLogin = isInitialized && !isAuthenticated && !publicRoute;
  const redirectingToDashboard = isInitialized && isAuthenticated && (route === 'login' || route === 'index' || !route);

  useEffect(() => {
    if (!navigationState?.key || !isInitialized) return;
    if (__DEV__) console.log('[Auth] protected-route decision', { route: route || 'index', isAuthenticated, publicRoute });
    if (redirectingToLogin) router.replace('/login' as any);
    if (redirectingToDashboard) router.replace('/dashboard' as any);
  }, [isAuthenticated, isInitialized, navigationState?.key, publicRoute, redirectingToDashboard, redirectingToLogin, route, router]);

  useEffect(() => {
    if (isInitialized && !redirectingToLogin && !redirectingToDashboard) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [isInitialized, redirectingToDashboard, redirectingToLogin]);

  if (!isInitialized) return null;
  if (redirectingToLogin || redirectingToDashboard) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(projectFonts);

  if (!fontsLoaded && !fontError) return null;
  if (fontsLoaded) applyGlobalFont();

  return (
    <AuthProvider>
      <AuthRouteBoundary>
        <Slot />
      </AuthRouteBoundary>
      <Toast config={toastConfig} />
    </AuthProvider>
  );
}
