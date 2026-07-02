import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { AppBottomNav } from '@/components/app-bottom-nav';

const API_URL = 'https://afariex.ir/API/transactions-history.php';

type TransactionType = 'deposit' | 'withdraw' | 'remittance' | string;
type FilterType = 'all' | 'deposit' | 'withdraw' | 'remittance';

type TransactionItem = {
  id: string;
  raw_id: string;
  source: string;
  amount: string;
  tracking_code: string;
  type: TransactionType;
  status: string;
  receipt_image: string;
  created_at: string;
  description: string;
  receipt_full_url: string;
};

const toSafeString = (value: unknown) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const normalizeTransaction = (item: any): TransactionItem => ({
  id: toSafeString(item?.id),
  raw_id: toSafeString(item?.raw_id),
  source: toSafeString(item?.source),
  amount: toSafeString(item?.amount),
  tracking_code: toSafeString(item?.tracking_code),
  type: toSafeString(item?.type),
  status: toSafeString(item?.status),
  receipt_image: toSafeString(item?.receipt_image),
  created_at: toSafeString(item?.created_at),
  description: toSafeString(item?.description),
  receipt_full_url: toSafeString(item?.receipt_full_url),
});

const toPersianNum = (num: string | number) => {
  if (num === null || num === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[Number(x)]);
};

const formatPrice = (value: number) => {
  const safeValue = Number.isFinite(value) ? Math.abs(Math.round(value)) : 0;
  const formatted = safeValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toPersianNum(formatted);
};

const getTransactionMeta = (type: TransactionType) => {
  if (type === 'deposit') {
    return {
      label: 'واریز وجه',
      icon: 'arrow-down-circle-outline' as const,
      iconColor: '#0ed874',
      iconBackground: '#e6f6f2',
      amountSign: '+',
      amountColorStyle: styles.textAmountGreen,
    };
  }

  if (type === 'remittance') {
    return {
      label: 'ثبت حواله',
      icon: 'swap-horizontal-outline' as const,
      iconColor: '#8b5cf6',
      iconBackground: '#f3e8ff',
      amountSign: '-',
      amountColorStyle: styles.textAmountPurple,
    };
  }

  return {
    label: 'برداشت وجه',
    icon: 'arrow-up-circle-outline' as const,
    iconColor: '#ef4444',
    iconBackground: '#fee2e2',
    amountSign: '-',
    amountColorStyle: styles.textAmountRed,
  };
};

const getStatusMeta = (status: string) => {
  const normalized = status?.toLowerCase?.() || '';

  if (normalized === 'approved' || normalized === 'paid' || normalized === 'success' || normalized === 'completed') {
    return {
      text: 'موفق',
      badgeStyle: styles.bgApproved,
      textStyle: styles.textApproved,
    };
  }

  if (normalized === 'rejected' || normalized === 'failed' || normalized === 'cancelled') {
    return {
      text: 'رد شده',
      badgeStyle: styles.bgRejected,
      textStyle: styles.textRejected,
    };
  }

  return {
    text: 'در انتظار',
    badgeStyle: styles.bgPending,
    textStyle: styles.textPending,
  };
};

export default function TransactionsHistoryScreen() {
  const router = useRouter();
  const { userId, userToken, isAuthenticated } = useAuth();

  const [filter, setFilter] = useState<FilterType>('all');
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  const fetchTransactions = useCallback(async () => {
    try {
      setErrorText('');

      if (!isAuthenticated) {
        setTransactions([]);
        setErrorText('شما وارد حساب کاربری نشده‌اید.');
        return;
      }

      if (!userToken) {
        setTransactions([]);
        setErrorText('توکن کاربر در اپ پیدا نشد. لطفاً یک بار خارج شوید و دوباره وارد شوید.');
        return;
      }

      const body = new URLSearchParams();
      body.append('api_token', String(userToken));

      if (userId !== null && userId !== undefined) {
        body.append('user_id', String(userId));
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString(),
      });

      const rawText = await response.text();

      let data: any = null;

      try {
        data = JSON.parse(rawText);
      } catch (jsonError) {
        console.log('API RAW RESPONSE:', rawText);
        setTransactions([]);
        setErrorText('پاسخ API قابل خواندن نیست. احتمالاً خطای PHP یا HTML برگشته است.');
        return;
      }

      console.log('TRANSACTIONS API RESPONSE:', data);

      if (data?.status === 'success') {
        const list = Array.isArray(data.data) ? data.data.map(normalizeTransaction) : [];
        setTransactions(list);
        return;
      }

      setTransactions([]);
      setErrorText(data?.message || 'خطای نامشخص در دریافت تراکنش‌ها.');
    } catch (error) {
      console.log('TRANSACTIONS FETCH ERROR:', error);
      setTransactions([]);
      setErrorText('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, userId, userToken]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  const tabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'همه' },
    { key: 'deposit', label: 'واریزی‌ها' },
    { key: 'withdraw', label: 'پرداختی‌ها' },
    { key: 'remittance', label: 'حواله‌ها' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.outerBackground}>
        <View style={styles.boxedContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>تاریخچه تراکنش‌ها</Text>

            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-forward" size={24} color="#4b5563" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabsWrapper}>
            <View style={styles.tabsContainer}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabBtn, filter === tab.key && styles.tabBtnActive]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {loading ? (
              <View style={styles.emptyStateContainer}>
                <ActivityIndicator size="large" color="#0ed874" />
                <Text style={styles.loadingText}>در حال دریافت تراکنش‌ها...</Text>
              </View>
            ) : errorText ? (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="warning-outline" size={40} color="#ef4444" />
                </View>

                <Text style={styles.emptyStateTitle}>خطا در دریافت اطلاعات</Text>
                <Text style={styles.emptyStateSub}>{errorText}</Text>

                <TouchableOpacity style={styles.retryButton} onPress={fetchTransactions}>
                  <Text style={styles.retryButtonText}>تلاش دوباره</Text>
                </TouchableOpacity>
              </View>
            ) : filteredTransactions.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="receipt-outline" size={40} color="#9ca3af" />
                </View>

                <Text style={styles.emptyStateTitle}>تراکنشی یافت نشد</Text>
                <Text style={styles.emptyStateSub}>
                  در این دسته‌بندی هنوز هیچ تراکنشی ثبت نشده است.
                </Text>
              </View>
            ) : (
              filteredTransactions.map((tx, index) => {
                const transactionMeta = getTransactionMeta(tx.type);
                const statusMeta = getStatusMeta(tx.status);

                const parsedAmount = Number(tx.amount || 0);
                const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;

                const titleText = tx.description || transactionMeta.label;

                return (
                  <View key={tx.id || `${tx.source}-${tx.raw_id}-${index}`} style={styles.txCard}>
                    <View style={[styles.txIconCircle, { backgroundColor: transactionMeta.iconBackground }]}>
                      <Ionicons
                        name={transactionMeta.icon}
                        size={22}
                        color={transactionMeta.iconColor}
                      />
                    </View>

                    <View style={styles.txLeft}>
                      <Text style={[styles.txAmount, transactionMeta.amountColorStyle]}>
                        {transactionMeta.amountSign} {formatPrice(safeAmount)}{' '}
                        <Text style={styles.currencyText}>تومان</Text>
                      </Text>

                      <View style={[styles.badge, statusMeta.badgeStyle]}>
                        <Text style={[styles.badgeText, statusMeta.textStyle]}>
                          {statusMeta.text}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.txRight}>
                      <Text style={styles.txTitle}>{titleText}</Text>

                      {!!tx.created_at && (
                        <Text style={styles.txDateCode}>
                          {toPersianNum(tx.created_at)}
                        </Text>
                      )}

                      {!!tx.tracking_code && (
                        <Text style={styles.txDateCode}>
                          کد رهگیری: {toPersianNum(tx.tracking_code)}
                        </Text>
                      )}

                      {!!tx.receipt_full_url && (
                        <Text style={styles.txDateCode}>رسید ثبت شده</Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tabText: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: 'Vazirmatn',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0ed874',
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 0,
    flexGrow: 1,
    paddingBottom: 70,
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  txIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
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
    color: '#0ed874',
  },
  textAmountRed: {
    color: '#ef4444',
  },
  textAmountPurple: {
    color: '#8b5cf6',
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
  bgPending: {
    backgroundColor: '#fef3c7',
  },
  textPending: {
    color: '#d97706',
  },
  bgApproved: {
    backgroundColor: '#e6f6f2',
  },
  textApproved: {
    color: '#0ed874',
  },
  bgRejected: {
    backgroundColor: '#fee2e2',
  },
  textRejected: {
    color: '#dc2626',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
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
    textAlign: 'center',
  },
  emptyStateSub: {
    fontSize: 13,
    fontFamily: 'Vazirmatn',
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: 'Vazirmatn',
    color: '#6b7280',
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: '#0ed874',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Vazirmatn',
    fontWeight: 'bold',
  },
});
