import { Slot, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
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

function AuthRouteGuard() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isInitialized } = useAuth();

  useEffect(() => {
    if (!navigationState?.key || !isInitialized) return;
    const route = segments[0] as string | undefined;
    const publicRoute = !route || route === 'index' || route === 'login' || route === 'register';
    if (__DEV__) console.log('[Auth] protected-route decision', { route: route || 'index', isAuthenticated, publicRoute });
    if (!isAuthenticated && !publicRoute) router.replace('/login' as any);
    if (isAuthenticated && route === 'login') router.replace('/dashboard' as any);
  }, [isAuthenticated, isInitialized, navigationState?.key, router, segments]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(projectFonts);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;
  if (fontsLoaded) applyGlobalFont();

  return (
    <AuthProvider>
      <AuthRouteGuard />
      <Slot />
      <Toast config={toastConfig} />
    </AuthProvider>
  );
}
