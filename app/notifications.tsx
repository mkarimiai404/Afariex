import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { showError } from '@/lib/toast';
import { AppBottomNav } from '@/components/app-bottom-nav';

const toPersianNum = (num: string | number) => {
  if (!num) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

export default function NotificationsScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { userToken, userId, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
  setLoading(true);
  try {
    if (!isAuthenticated) {
      router.replace('/login' as any);
      return;
    }
    if (!userId && !userToken) {
      showError('خطا', 'اطلاعات ورود نامعتبر است. لطفاً دوباره وارد شوید.');
      return;
    }

    const payload = new URLSearchParams();
    if (userToken) {
      payload.append('api_token', userToken);
      payload.append('token', userToken);
      payload.append('user_token', userToken);
    }
    if (userId) {
      payload.append('user_id', userId);
      payload.append('id', userId);
    }

    console.log('[Notifications] requesting get_notifications.php');
    
    const data = await fetchJson<any>('get_notifications.php', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    console.log('[Notifications] parsed response:', data);

    // ********** اصلاح اصلی دقیقاً اینجاست **********
    if (data?.success === true && Array.isArray(data.rows)) {
      setNotifications(data.rows);
    } else {
      showError('خطا', data.message || 'خطا در دریافت اطلاعات');
      setNotifications([]);
    }

  } catch (error) {
    console.warn('[Notifications] request failed:', error);
    if (error instanceof Error) {
      console.log('[Notifications] error message:', error.message);
      console.log('[Notifications] error cause:', error.cause);
    }
    showError('خطای ارتباط', 'خطا در ارتباط با سرور');
    setNotifications([]);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    if (!rootNavigationState?.key) return;
    fetchNotifications();
  }, [isAuthenticated, userId, userToken, rootNavigationState?.key]);

  const renderNotification = ({ item }: { item: any }) => (
    <View style={[styles.notificationCard, item.is_read == 0 && styles.unreadCard]}>
      <View style={styles.iconContainer}>
        <Ionicons name="notifications" size={24} color={item.is_read == 0 ? "#0ed874" : "#a0aec0"} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>{toPersianNum(item.created_at)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.outerBackground}>
        <View style={styles.boxedContainer}>
          
          <View style={styles.customHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-forward" size={24} color="#4b5563" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>اعلانات</Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#0ed874" />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="notifications-off-outline" size={60} color="#cbd5e0" />
              <Text style={styles.emptyText}>هیچ اعلانی یافت نشد.</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderNotification}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}

        </View>
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
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 70,
  },
  boxedContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  customHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 70,
  },
  notificationCard: {
    flexDirection: 'row-reverse',
    backgroundColor: '#ffffff',
    padding: 15,
    marginBottom: 10,
    borderWidth: 0,
  },
  unreadCard: {
    backgroundColor: '#f5fbf8',
  },
  iconContainer: {
    marginLeft: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 5,
    textAlign: 'right',
  },
  message: {
    fontSize: 12,
    fontFamily: 'Vazirmatn',
    color: '#4a5568',
    marginBottom: 8,
    textAlign: 'right',
    lineHeight: 20,
  },
  date: {
    fontSize: 10,
    fontFamily: 'Vazirmatn',
    color: '#a0aec0',
    textAlign: 'left',
  },
  emptyText: {
    color: '#718096',
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    marginTop: 15,
  },
});
