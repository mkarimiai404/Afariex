import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const toPersianNum = (num: string | number) => {
  if (!num) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await AsyncStorage.getItem('userToken');
       console.log("Token from storage:", token);
      
      // آدرس API به دامنه جدید تغییر یافت
      const response = await fetch('http://mazhikeabi.com/API/get_notifications.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_token: token }),
      });

      const data = await response.json();

      if (data.status === 'true') {
        setNotifications(data.data || data.notifications || []);
      } else {
        setError(data.message || 'خطا در دریافت اطلاعات');
      }
    } catch (err) {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const renderNotification = ({ item }: { item: any }) => (
    <View style={[styles.notificationCard, item.is_read == 0 && styles.unreadCard]}>
      <View style={styles.iconContainer}>
        <Ionicons name="notifications" size={24} color={item.is_read == 0 ? "#10a37f" : "#a0aec0"} />
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
              <ActivityIndicator size="large" color="#10a37f" />
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchNotifications}>
                <Text style={styles.retryBtnText}>تلاش مجدد</Text>
              </TouchableOpacity>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7f9', 
  },
  outerBackground: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 40,
  },
  boxedContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 30, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
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
  },
  notificationCard: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f9fafb',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  unreadCard: {
    backgroundColor: '#e6f6f2',
    borderColor: '#10a37f',
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
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 5,
    textAlign: 'right',
  },
  message: {
    fontSize: 12,
    color: '#4a5568',
    marginBottom: 8,
    textAlign: 'right',
    lineHeight: 20,
  },
  date: {
    fontSize: 10,
    color: '#a0aec0',
    textAlign: 'left',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: '#718096',
    fontSize: 14,
    marginTop: 15,
  },
  retryBtn: {
    backgroundColor: '#10a37f',
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
