import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// تابع تبدیل اعداد به فارسی
const toPersianNum = (num: string | number) => {
  if (!num) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

// تبدیل قیمت با کاما
const formatPrice = (price: number) => {
  const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return toPersianNum(formatted);
};

export default function TransactionsHistoryScreen() {
  const router = useRouter();
  const { userId, userToken, isAuthenticated } = useAuth();
  const [filter, setFilter] = useState('all'); // all, deposit, withdraw
  
  // داده‌های تراکنش
  const [transactions, setTransactions] = useState<any[]>([]);

  // دریافت اطلاعات از API هنگام لود شدن صفحه
  useEffect(() => {
    fetchTransactions();
  }, [isAuthenticated, userId, userToken]);

  const fetchTransactions = async () => {
    try {
      if (!isAuthenticated || !userId) {
        router.replace('/login' as any);
        return;
      }

      const data = await fetchJson<any>('get_transactions.php', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          user_id: userId,
          ...(userToken ? { api_token: userToken, token: userToken, user_token: userToken } : {}),
        }).toString(),
      });

      // فرض بر این است که API ساختار status/success دارد و داده‌ها در data.data هستند
      if (data.status === 'true' || data.success) {
        setTransactions(data.data || []);
      }
    } catch (error) {
      console.log('Error fetching transactions:', error);
      if (error instanceof Error) {
        console.log('[Transactions] error message:', error.message);
        console.log('[Transactions] error cause:', error.cause);
      }
    }
  };

  // فیلتر کردن لیست تراکنش‌ها
  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* پس‌زمینه اصلی برای حفظ ظاهر باکس‌دار مشابه داشبورد */}
      <View style={styles.outerBackground}>
        <View style={styles.boxedContainer}>
          
          {/* هدر */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>تاریخچه تراکنش‌ها</Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-forward" size={24} color="#4b5563" />
            </TouchableOpacity>
          </View>

          {/* تب‌های فیلتر (سگمنت کنترل) */}
          <View style={styles.tabsWrapper}>
            <View style={styles.tabsContainer}>
              <TouchableOpacity 
                style={[styles.tabBtn, filter === 'all' && styles.tabBtnActive]} 
                onPress={() => setFilter('all')}
              >
                <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>همه</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabBtn, filter === 'deposit' && styles.tabBtnActive]} 
                onPress={() => setFilter('deposit')}
              >
                <Text style={[styles.tabText, filter === 'deposit' && styles.tabTextActive]}>واریزی‌ها</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabBtn, filter === 'withdraw' && styles.tabBtnActive]} 
                onPress={() => setFilter('withdraw')}
              >
                <Text style={[styles.tabText, filter === 'withdraw' && styles.tabTextActive]}>پرداختی‌ها</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* لیست تراکنش‌ها */}
          <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
            
            {filteredTransactions.length === 0 ? (
              // Empty State - نمایش زمانی که دیتایی نیست
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="receipt-outline" size={40} color="#9ca3af" />
                </View>
                <Text style={styles.emptyStateTitle}>تراکنشی یافت نشد</Text>
                <Text style={styles.emptyStateSub}>در این دسته‌بندی هنوز هیچ تراکنشی ثبت نشده است.</Text>
              </View>
            ) : (
              // رندر کردن لیست در صورت وجود دیتا
              filteredTransactions.map((tx, index) => {
                let statusText = 'در انتظار';
                let badgeStyle = styles.bgPending;
                let badgeTextStyle = styles.textPending;

                if (tx.status === 'approved') {
                  statusText = 'موفق';
                  badgeStyle = styles.bgApproved;
                  badgeTextStyle = styles.textApproved;
                } else if (tx.status === 'rejected') {
                  statusText = 'رد شده';
                  badgeStyle = styles.bgRejected;
                  badgeTextStyle = styles.textRejected;
                }

                const isDeposit = tx.type === 'deposit';
                const amountSign = isDeposit ? '+' : '-';
                const amountColorStyle = isDeposit ? styles.textAmountGreen : styles.textAmountRed;

                return (
                  <View key={tx.id || index} style={styles.txCard}>
                    
                    {/* مقادیر سمت چپ (مبلغ و وضعیت) */}
                    <View style={styles.txLeft}>
                      <Text style={[styles.txAmount, amountColorStyle]}>
                        {amountSign} {formatPrice(tx.amount || 0)} <Text style={styles.currencyText}>تومان</Text>
                      </Text>
                      <View style={[styles.badge, badgeStyle]}>
                        <Text style={[styles.badgeText, badgeTextStyle]}>{statusText}</Text>
                      </View>
                    </View>

                    {/* اطلاعات سمت راست (توضیحات و تاریخ) */}
                    <View style={styles.txRight}>
                      <Text style={styles.txTitle}>{tx.description}</Text>
                      <Text style={styles.txDateCode}>
                        {toPersianNum(tx.created_at || '')}
                      </Text>
                      {tx.tracking_code && (
                        <Text style={styles.txDateCode}>
                          کد رهگیری: {toPersianNum(tx.tracking_code)}
                        </Text>
                      )}
                    </View>

                  </View>
                );
              })
            )}

          </ScrollView>

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
    justifyContent: 'center',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    color: '#1f2937',
  },
  backBtn: {
    position: 'absolute',
    right: 20,
    padding: 5,
  },
  tabsWrapper: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabsContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    color: '#6b7280',
    fontSize: 13,
    fontFamily: 'Vazirmatn',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0ed874', // هم‌رنگ با تم داشبورد
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  txRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'right',
    marginBottom: 6,
  },
  txDateCode: {
    fontSize: 11,
    fontFamily: 'Vazirmatn',
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 2,
  },
  txLeft: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: 15,
  },
  txAmount: {
    fontSize: 15,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 6,
  },
  currencyText: {
    fontSize: 10,
    fontFamily: 'Vazirmatn',
    fontWeight: 'normal',
  },
  textAmountGreen: {
    color: '#0ed874', // هماهنگ با تم سبز
  },
  textAmountRed: {
    color: '#ef4444',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
  },
  bgPending: { backgroundColor: '#fef3c7' },
  textPending: { color: '#d97706' },
  
  bgApproved: { backgroundColor: '#e6f6f2' }, // هماهنگ با تم داشبورد
  textApproved: { color: '#0ed874' },
  
  bgRejected: { backgroundColor: '#fee2e2' },
  textRejected: { color: '#dc2626' },

  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateSub: {
    fontSize: 13,
    fontFamily: 'Vazirmatn',
    color: '#9ca3af',
    textAlign: 'center',
  },
});
