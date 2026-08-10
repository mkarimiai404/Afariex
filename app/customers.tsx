import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchJson, isAuthenticationResponseError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { showError, showSuccess } from '@/lib/toast';

type ReferralCustomer = {
  id: number;
  name: string | null;
  mobile: string | null;
  registered_at: string | null;
  level: string;
  level_title: string;
  verified: boolean;
};

type ReferralData = {
  referral_code: string;
  total_invited: number;
  active_invited: number;
  started_at: string | null;
  customers: ReferralCustomer[];
};

const fallbackData: ReferralData = {
  referral_code: '—', total_invited: 0, active_invited: 0, started_at: null, customers: [],
};

const formatDate = (value: string | null) => {
  if (!value) return 'ثبت نشده';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

export default function CustomersScreen() {
  const router = useRouter();
  const { userToken, isAuthenticated, isInitialized } = useAuth();
  const [data, setData] = useState<ReferralData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadReferrals = useCallback(async () => {
    if (!isInitialized) return;
    if (!isAuthenticated || !userToken) {
      setLoading(false);
      router.replace('/login' as any);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const body = new URLSearchParams({ api_token: String(userToken) });
      const result = await fetchJson<{ success?: boolean; data?: ReferralData; code?: string }>('referrals.php', {
        method: 'POST',
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (result?.success !== true || !result.data) throw new Error('Invalid referrals response');
      setData({ ...fallbackData, ...result.data, customers: Array.isArray(result.data.customers) ? result.data.customers : [] });
    } catch (requestError) {
      if (isAuthenticationResponseError(requestError)) return;
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isInitialized, router, userToken]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const copyCode = async () => {
    if (data.referral_code === '—') return;
    await Clipboard.setStringAsync(data.referral_code);
    showSuccess('کد دعوت کپی شد', 'کد دعوت شما در کلیپ‌بورد ذخیره شد.');
  };

  const shareCode = async () => {
    if (data.referral_code === '—') return;
    try {
      await Share.share({ message: `با کد دعوت ${data.referral_code} به آفاریکس بپیوندید.` });
    } catch {
      showError('اشتراک‌گذاری انجام نشد', 'لطفاً دوباره تلاش کنید.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="بازگشت">
              <Ionicons name="arrow-forward" size={21} color="#243247" />
            </TouchableOpacity>
            <Text style={styles.title}>مشتریان من</Text>
            <View style={styles.headerSpace} />
          </View>

          {loading ? (
            <View style={styles.stateWrap}><View style={styles.stateIcon}><ActivityIndicator color="#10a875" /></View><Text style={styles.stateTitle}>در حال دریافت مشتریان</Text></View>
          ) : error ? (
            <View style={styles.stateWrap}>
              <View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={28} color="#c47a24" /></View>
              <Text style={styles.stateTitle}>دریافت اطلاعات انجام نشد</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadReferrals}><Text style={styles.retryText}>تلاش مجدد</Text></TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              <LinearGradient colors={['#173e4d', '#087e69']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.referralCard}>
                <View style={styles.cardTop}><View style={styles.cardIcon}><Ionicons name="gift-outline" size={23} color="#b9f3dc" /></View><Text style={styles.eyebrow}>دعوت اختصاصی شما</Text></View>
                <Text style={styles.cardTitle}>دعوت از دوستان</Text>
                <Text style={styles.cardDescription}>با دعوت کاربران جدید به آفاریکس، شبکه خود را گسترش دهید.</Text>
                <View style={styles.codeBox}><Text style={styles.codeLabel}>کد دعوت شما</Text><Text style={styles.code}>{data.referral_code}</Text></View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton} onPress={copyCode}><Ionicons name="copy-outline" size={17} color="#164052" /><Text style={styles.actionText}>کپی کد</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={shareCode}><Ionicons name="share-social-outline" size={17} color="#164052" /><Text style={styles.actionText}>اشتراک‌گذاری</Text></TouchableOpacity>
                </View>
              </LinearGradient>

              <View style={styles.statsRow}>
                <StatCard icon="people-outline" value={String(data.total_invited)} label="تعداد دعوت‌ها" />
                <StatCard icon="checkmark-circle-outline" value={String(data.active_invited)} label="کاربران فعال‌شده" />
                <StatCard icon="calendar-outline" value={formatDate(data.started_at)} label="شروع فعالیت" compact />
              </View>

              <View style={styles.listCard}>
                <View style={styles.listHeader}><Text style={styles.sectionTitle}>کاربران دعوت‌شده</Text><View style={styles.countBadge}><Text style={styles.countText}>{data.total_invited}</Text></View></View>
                {data.customers.length === 0 ? (
                  <View style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name="people-outline" size={28} color="#7b8d95" /></View><Text style={styles.emptyTitle}>هنوز مشتری‌ای ندارید</Text><Text style={styles.emptyCaption}>هنوز کسی با کد دعوت شما ثبت‌نام نکرده است.</Text></View>
                ) : data.customers.map((customer, index) => <CustomerRow key={customer.id} customer={customer} last={index === data.customers.length - 1} />)}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label, compact = false }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; compact?: boolean }) {
  return <View style={styles.statCard}><View style={styles.statIcon}><Ionicons name={icon} size={18} color="#0e9471" /></View><Text style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={1}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function CustomerRow({ customer, last }: { customer: ReferralCustomer; last: boolean }) {
  return <View style={[styles.customerRow, last && styles.lastRow]}>
    <View style={styles.avatar}><Ionicons name="person" size={19} color="#6e8b91" /></View>
    <View style={styles.customerInfo}><Text style={styles.customerName} numberOfLines={1}>{customer.name || 'کاربر آفاریکس'}</Text><Text style={styles.customerPhone}>{customer.mobile || 'شماره ثبت نشده'}</Text><Text style={styles.customerDate}>عضویت: {formatDate(customer.registered_at)}</Text></View>
    <View style={styles.customerMeta}><View style={[styles.levelBadge, customer.level === 'gold' && styles.goldBadge, customer.level === 'silver' && styles.silverBadge]}><Text style={styles.levelText}>{customer.level_title}</Text></View><View style={styles.verifiedLine}><Ionicons name={customer.verified ? 'checkmark-circle' : 'time-outline'} size={14} color={customer.verified ? '#12976e' : '#9aa7ac'} /><Text style={styles.verifiedText}>{customer.verified ? 'تایید شده' : 'در انتظار تایید'}</Text></View></View>
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f7f8' }, screen: { flex: 1, backgroundColor: '#f4f7f8' }, container: { flex: 1, width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14 },
  header: { height: 52, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5ecee' }, title: { fontFamily: 'VazirmatnBold', fontSize: 18, color: '#172b3a' }, headerSpace: { width: 44, height: 44 }, content: { paddingBottom: 32 },
  referralCard: { borderRadius: 24, padding: 20, shadowColor: '#123c4a', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 }, cardTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }, cardIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }, eyebrow: { fontFamily: 'Vazirmatn', color: '#c5eee0', fontSize: 12 }, cardTitle: { fontFamily: 'VazirmatnBold', color: '#fff', textAlign: 'right', fontSize: 22, marginTop: 17 }, cardDescription: { fontFamily: 'Vazirmatn', color: '#d5eee8', textAlign: 'right', fontSize: 12, lineHeight: 21, marginTop: 5 }, codeBox: { marginTop: 18, borderRadius: 15, paddingVertical: 12, paddingHorizontal: 15, backgroundColor: 'rgba(0,0,0,0.16)', alignItems: 'flex-end' }, codeLabel: { fontFamily: 'Vazirmatn', color: '#b9ded5', fontSize: 10 }, code: { fontFamily: 'VazirmatnBold', color: '#fff', fontSize: 22, letterSpacing: 1.5, marginTop: 2 }, actions: { flexDirection: 'row-reverse', gap: 10, marginTop: 15 }, actionButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#fff', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 }, actionText: { fontFamily: 'VazirmatnBold', fontSize: 12, color: '#164052' },
  statsRow: { flexDirection: 'row-reverse', gap: 9, marginTop: 14 }, statCard: { flex: 1, minHeight: 108, backgroundColor: '#fff', borderRadius: 17, padding: 12, alignItems: 'flex-end', borderWidth: 1, borderColor: '#e7eeee' }, statIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#eaf8f3', alignItems: 'center', justifyContent: 'center' }, statValue: { width: '100%', fontFamily: 'VazirmatnBold', fontSize: 20, color: '#203746', textAlign: 'right', marginTop: 8 }, statValueCompact: { fontSize: 11, marginTop: 12 }, statLabel: { width: '100%', fontFamily: 'Vazirmatn', fontSize: 10, color: '#819197', textAlign: 'right', marginTop: 1 },
  listCard: { backgroundColor: '#fff', borderRadius: 20, marginTop: 16, paddingHorizontal: 17, paddingTop: 17, borderWidth: 1, borderColor: '#e5ecec' }, listHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingBottom: 13 }, sectionTitle: { fontFamily: 'VazirmatnBold', fontSize: 16, color: '#223746' }, countBadge: { minWidth: 25, height: 25, paddingHorizontal: 6, borderRadius: 13, backgroundColor: '#e9f7f2', alignItems: 'center', justifyContent: 'center' }, countText: { fontFamily: 'VazirmatnBold', fontSize: 11, color: '#0e8f70' }, customerRow: { minHeight: 91, flexDirection: 'row-reverse', alignItems: 'center', columnGap: 12, borderTopWidth: 1, borderTopColor: '#edf2f1', paddingVertical: 13 }, lastRow: { borderBottomWidth: 0 }, avatar: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#edf5f5', alignItems: 'center', justifyContent: 'center' }, customerInfo: { flex: 1, minWidth: 0, alignItems: 'flex-end' }, customerName: { width: '100%', fontFamily: 'VazirmatnBold', fontSize: 13, color: '#263b49', textAlign: 'right' }, customerPhone: { width: '100%', fontFamily: 'Vazirmatn', fontSize: 11, color: '#75878e', textAlign: 'right', marginTop: 2 }, customerDate: { width: '100%', fontFamily: 'Vazirmatn', fontSize: 10, color: '#9aa6aa', textAlign: 'right', marginTop: 2 }, customerMeta: { alignItems: 'flex-end', minWidth: 76, gap: 6 }, levelBadge: { borderRadius: 10, backgroundColor: '#f3eadc', paddingHorizontal: 7, paddingVertical: 4 }, goldBadge: { backgroundColor: '#f8edce' }, silverBadge: { backgroundColor: '#edf1f4' }, levelText: { fontFamily: 'Vazirmatn', fontSize: 9, color: '#806735', textAlign: 'right' }, verifiedLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }, verifiedText: { fontFamily: 'Vazirmatn', fontSize: 9, color: '#74868c' },
  emptyState: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: '#edf2f1' }, emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f1f6f6', alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontFamily: 'VazirmatnBold', fontSize: 14, color: '#334b56', marginTop: 12 }, emptyCaption: { fontFamily: 'Vazirmatn', fontSize: 11, color: '#89979b', textAlign: 'center', marginTop: 5 },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }, stateIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#e7f6f0', alignItems: 'center', justifyContent: 'center' }, stateTitle: { fontFamily: 'VazirmatnBold', color: '#2d4652', fontSize: 14, marginTop: 15 }, retryButton: { minHeight: 42, marginTop: 18, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#0e9c73', alignItems: 'center', justifyContent: 'center' }, retryText: { fontFamily: 'VazirmatnBold', color: '#fff', fontSize: 12 },
});
