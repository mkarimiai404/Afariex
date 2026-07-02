import { Slot } from 'expo-router';
import Toast from 'react-native-toast-message';

import { AuthProvider } from '@/lib/auth-context';
import { toastConfig } from '@/lib/toast';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Slot />
      <Toast config={toastConfig} />
    </AuthProvider>
  );
}
