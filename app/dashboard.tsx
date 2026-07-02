import React, { useEffect, useState } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, Stack, useRootNavigationState } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppBottomNav } from '@/components/app-bottom-nav';

const toPersianNum = (num: string | number) => {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

const formatPrice = (price: number) => {
  const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toPersianNum(formatted);
};

const normalizeBalance = (value: unknown): number => {
  const numericValue = Number(typeof value === 'string' ? value.replace(/,/g, '').trim() : value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export default function DashboardScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const navigationReady = Boolean(rootNavigationState?.key);
  const { userId, userToken, userName, isAuthenticated, isInitialized } = useAuth();
  const [walletBalance, setWalletBalance] = useState(0);
  const unreadCount = 1;

  const fetchUserData = React.useCallback(async () => {
    if (!navigationReady || !isInitialized) {
      return;
    }

    try {
      if (!userId || !userToken) {
        router.replace('/login' as any);
        return;
      }

      const payload = new URLSearchParams();
      payload.append('user_id', userId);
      payload.append('id', userId);
      payload.append('uid', userId);
      payload.append('api_token', userToken);
      payload.append('token', userToken);
      payload.append('user_token', userToken);

      const data = await fetchJson<any>('dashboard.php', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });

      const balanceValue =
        data?.balance ??
        data?.user?.balance ??
        data?.data?.balance ??
        data?.result?.balance;

      setWalletBalance(normalizeBalance(balanceValue));
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, [isInitialized, navigationReady, router, userId, userToken]);

  useEffect(() => {
    if (!navigationReady || !isInitialized) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/login' as any);
      setWalletBalance(0);
      return;
    }

    fetchUserData();
  }, [fetchUserData, isAuthenticated, isInitialized, navigationReady, router]);

  useFocusEffect(
    React.useCallback(() => {
      if (navigationReady && isInitialized && isAuthenticated) {
        fetchUserData();
      }
    }, [fetchUserData, isAuthenticated, isInitialized, navigationReady])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && navigationReady && isInitialized && isAuthenticated) {
        fetchUserData();
      }
    });

    return () => subscription.remove();
  }, [fetchUserData, isAuthenticated, isInitialized, navigationReady]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.outerBackground}>
        <ScrollView
          style={styles.mainContent}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topHeader}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color="#0ed874" />
              </View>
              <View style={styles.welcomeText}>
                <Text style={styles.welcomeSub}>سلام، خوش آمدید</Text>
                <Text style={styles.welcomeName}>{userName || 'کاربر گرامی'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push('/notifications' as any)}>
              <Ionicons name="notifications-outline" size={20} color="#4b5563" />
              {unreadCount > 0 && <View style={styles.notifBadgeIndicator} />}
            </TouchableOpacity>
          </View>

          <LinearGradient
            colors={['#0ed874', '#0d8a6a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.walletCard}
          >
            <View style={styles.walletDecoration} />
            <Text style={styles.walletTitle}>موجودی کیف پول</Text>
            <View style={styles.walletBalanceContainer}>
              <Text style={styles.walletAmount}>{formatPrice(walletBalance)}</Text>
              <Text style={styles.walletCurrency}>تومان</Text>
            </View>

            <View style={styles.walletActions}>
              <TouchableOpacity style={styles.btnDeposit} onPress={() => router.push('/add-balance' as any)}>
                <Text style={styles.btnDepositText}>افزایش موجودی</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnHistory} onPress={() => router.push('/transactions-history' as any)}>
                <Text style={styles.btnHistoryText}>تاریخچه</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={styles.servicesSection}>
            <Text style={styles.sectionTitle}>خدمات آفاریکس</Text>

            <View style={styles.servicesGrid}>
              <TouchableOpacity style={styles.serviceItem} onPress={() => router.push('/add-remittance' as any)}>
                <View style={[styles.iconWrapper, { backgroundColor: '#e3f2fd' }]}>
                  <MaterialCommunityIcons
                    name="send"
                    size={24}
                    color="#1976d2"
                    style={{ transform: [{ rotate: '-45deg' }] }}
                  />
                </View>
                <Text style={styles.serviceText}>حواله</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.serviceItem} onPress={() => router.push('/add-balance' as any)}>
                <View style={[styles.iconWrapper, { backgroundColor: '#e8f5e9' }]}>
                  <Ionicons name="wallet" size={24} color="#388e3c" />
                </View>
                <Text style={styles.serviceText}>کیف پول</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.serviceItem} onPress={() => router.push('/profile' as any)}>
                <View style={[styles.iconWrapper, { backgroundColor: '#eef6ff' }]}>
                  <Ionicons name="headset" size={24} color="#0ea5e9" />
                </View>
                <Text style={styles.serviceText}>پشتیبانی</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <AppBottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  outerBackground: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 70,
  },
  topHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    backgroundColor: '#e6f6f2',
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  welcomeText: {
    justifyContent: 'center',
  },
  welcomeSub: {
    fontSize: 11,
    fontFamily: 'Vazirmatn',
    color: '#718096',
    textAlign: 'right',
  },
  welcomeName: {
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'right',
    marginTop: 2,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadgeIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  walletCard: {
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  walletDecoration: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 50,
  },
  walletTitle: {
    fontSize: 12,
    fontFamily: 'Vazirmatn',
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
    textAlign: 'right',
  },
  walletBalanceContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  walletAmount: {
    fontSize: 26,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    color: '#fff',
  },
  walletCurrency: {
    fontSize: 12,
    fontFamily: 'Vazirmatn',
    color: '#fff',
    opacity: 0.9,
    marginRight: 5,
  },
  walletActions: {
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
  },
  btnDeposit: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDepositText: {
    color: '#0ed874',
    fontSize: 13,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
  },
  btnHistory: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnHistoryText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
  },
  servicesSection: {
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
    textAlign: 'right',
  },
  servicesGrid: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 12,
  },
  serviceItem: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceText: {
    fontSize: 11,
    fontFamily: 'Vazirmatn',
    color: '#2d3748',
    fontWeight: '500',
    textAlign: 'center',
  },
});
