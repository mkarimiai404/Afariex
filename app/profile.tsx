import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { useAuth } from '@/lib/auth-context';

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  iconSet: 'ionicons' | 'material';
  accent: string;
};

const menuItems: MenuItem[] = [
  { key: 'access', label: 'سطح دسترسی', icon: 'shield-checkmark', iconSet: 'ionicons', accent: '#2563eb' },
  { key: 'profile', label: 'پروفایل من', icon: 'person', iconSet: 'ionicons', accent: '#0ed874' },
  { key: 'customers', label: 'مشتریان', icon: 'account-group', iconSet: 'material', accent: '#7c3aed' },
  { key: 'orders', label: 'سفارش ها', icon: 'clipboard-text-outline', iconSet: 'material', accent: '#f59e0b' },
  { key: 'cooperate', label: 'همکاری با ما', icon: 'handshake-outline', iconSet: 'material', accent: '#06b6d4' },
  { key: 'pin', label: 'تغییر پین کد', icon: 'key-outline', iconSet: 'ionicons', accent: '#ef4444' },
  { key: 'password', label: 'تغییر رمز عبور', icon: 'lock-closed-outline', iconSet: 'ionicons', accent: '#14b8a6' },
  { key: 'about', label: 'درباره ما', icon: 'information-circle-outline', iconSet: 'ionicons', accent: '#8b5cf6' },
  { key: 'support', label: 'پشتیبانی', icon: 'headset', iconSet: 'material', accent: '#0ea5e9' },
  { key: 'logout', label: 'خروج', icon: 'log-out-outline', iconSet: 'ionicons', accent: '#dc2626' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      if (router.canDismiss()) router.dismissAll();
      router.replace('/login' as any);
    } finally {
      setLoggingOut(false);
    }
  };

  const handlePlaceholderPress = (label: string) => {
    if (__DEV__) console.log(`Profile placeholder pressed: ${label}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="بازگشت"
          >
            <Ionicons name="arrow-forward" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>پروفایل</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, index === menuItems.length - 1 && styles.lastMenuItem]}
                onPress={() => item.key === 'logout' ? handleLogout() : item.key === 'access' ? router.push('/access-level' as any) : item.key === 'profile' ? router.push('/my-profile' as any) : item.key === 'customers' ? router.push('/customers' as any) : item.key === 'orders' ? router.push('/orders' as any) : item.key === 'cooperate' ? router.push('/partnership' as any) : item.key === 'pin' ? router.push('/change-pin' as any) : item.key === 'password' ? router.push('/change-password' as any) : item.key === 'about' ? router.push('/about' as any) : item.key === 'support' ? router.push('/support' as any) : handlePlaceholderPress(item.label)}
                disabled={item.key === 'logout' && loggingOut}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={[styles.iconBox, { backgroundColor: `${item.accent}15` }]}>
                  {item.iconSet === 'ionicons' ? (
                    <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={item.accent} />
                  ) : (
                    <MaterialCommunityIcons name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={item.accent} />
                  )}
                </View>
                {item.key === 'logout' && loggingOut ? <ActivityIndicator size="small" color={item.accent} /> : <Text style={styles.menuText}>{item.label}</Text>}
                <Ionicons name="chevron-back" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <AppBottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 70, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'VazirmatnBold', fontWeight: 'bold', color: '#1f2937' },
  placeholder: { width: 40, height: 40 },
  content: { paddingBottom: 70 },
  menuCard: {
    backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#eef2f7',
    shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  menuItem: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  lastMenuItem: { borderBottomWidth: 0 },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  menuText: { flex: 1, fontSize: 14, fontFamily: 'Vazirmatn', fontWeight: '600', color: '#111827', textAlign: 'right' },
});
