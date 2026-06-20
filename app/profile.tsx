import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { showSuccess } from '@/lib/toast';

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  iconSet: 'ionicons' | 'material';
  accent: string;
  action: () => void;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleComingSoon = (label: string) => {
    showSuccess(label, 'به زودی');
  };

  const handleLogout = async () => {
    Alert.alert('خروج', 'آیا از حساب کاربری خارج می‌شوید؟', [
      { text: 'انصراف', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          signOut();
          router.replace('/' as any);
        },
      },
    ]);
  };

  const menuItems: MenuItem[] = [
    { key: 'access', label: 'سطح دسترسی', icon: 'shield-checkmark', iconSet: 'ionicons', accent: '#2563eb', action: () => handleComingSoon('سطح دسترسی') },
    { key: 'profile', label: 'پروفایل من', icon: 'person', iconSet: 'ionicons', accent: '#0ed874', action: () => handleComingSoon('پروفایل من') },
    { key: 'customers', label: 'مشتریان', icon: 'account-group', iconSet: 'material', accent: '#7c3aed', action: () => handleComingSoon('مشتریان') },
    { key: 'orders', label: 'سفارش ها', icon: 'clipboard-text-outline', iconSet: 'material', accent: '#f59e0b', action: () => handleComingSoon('سفارش ها') },
    { key: 'cooperate', label: 'همکاری با ما', icon: 'handshake-outline', iconSet: 'material', accent: '#06b6d4', action: () => handleComingSoon('همکاری با ما') },
    { key: 'pin', label: 'تغییر پین کد', icon: 'key-outline', iconSet: 'ionicons', accent: '#ef4444', action: () => handleComingSoon('تغییر پین کد') },
    { key: 'password', label: 'تغییر رمز عبور', icon: 'lock-closed-outline', iconSet: 'ionicons', accent: '#14b8a6', action: () => handleComingSoon('تغییر رمز عبور') },
    { key: 'about', label: 'درباره ما', icon: 'information-circle-outline', iconSet: 'ionicons', accent: '#8b5cf6', action: () => handleComingSoon('درباره ما') },
    { key: 'support', label: 'پشتیبانی', icon: 'headset', iconSet: 'material', accent: '#0ea5e9', action: () => handleComingSoon('پشتیبانی') },
    { key: 'logout', label: 'خروج', icon: 'log-out-outline', iconSet: 'ionicons', accent: '#dc2626', action: handleLogout },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>پروفایل</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.card}>
            {menuItems.map((item) => (
              <TouchableOpacity key={item.key} style={styles.menuItem} onPress={item.action} activeOpacity={0.8}>
                <View style={[styles.iconBox, { backgroundColor: `${item.accent}15` }]}>
                  {item.iconSet === 'ionicons' ? (
                    <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={item.accent} />
                  ) : (
                    <MaterialCommunityIcons name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={item.accent} />
                  )}
                </View>

                <Text style={styles.menuText}>{item.label}</Text>

                <Ionicons name="chevron-back" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'VazirmatnBold',
    fontWeight: 'bold',
    color: '#1f2937',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  content: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingVertical: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
});
