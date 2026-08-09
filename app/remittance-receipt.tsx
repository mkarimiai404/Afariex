import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RemittanceReceiptView } from '@/components/remittance-receipt-view';
import { fetchJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { RemittanceReceiptModel } from '@/lib/remittance-receipt';
import { createRemittanceReceiptPdf } from '@/lib/remittance-receipt-native';
import { showError } from '@/lib/toast';

type ReceiptOrder = {
  id: string;
  type: string;
  status: string;
  created_at: string | null;
  metadata?: {
    tracking_number?: string | number;
    sender?: string;
    receiver?: string;
    amount_afghani?: string | number;
    destination?: string;
  };
};

const formatReceiptDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

export default function RemittanceReceiptScreen() {
  const router = useRouter();
  const { order } = useLocalSearchParams<{ order?: string }>();
  const { userToken, isAuthenticated, isInitialized } = useAuth();
  const [receipt, setReceipt] = useState<RemittanceReceiptModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'pdf' | 'share' | null>(null);
  const orderKey = useMemo(() => typeof order === 'string' ? order : '', [order]);

  const loadReceipt = useCallback(async () => {
    if (!isInitialized) return;
    if (!isAuthenticated || !userToken) {
      router.replace('/login' as never);
      return;
    }
    if (!/^remittance-\d+$/.test(orderKey)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const body = new URLSearchParams({ api_token: String(userToken) });
      const result = await fetchJson<{ success?: boolean; data?: { orders?: ReceiptOrder[] } }>('orders.php', {
        method: 'POST', body: body.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const owned = result?.data?.orders?.find((item) => item.id === orderKey && item.type === 'remittance');
      const metadata = owned?.metadata;
      if (!owned || !metadata?.tracking_number || !metadata.sender || !metadata.receiver || !metadata.destination) {
        setReceipt(null);
        return;
      }
      setReceipt({
        trackingNumber: String(metadata.tracking_number),
        date: formatReceiptDate(owned.created_at),
        sender: metadata.sender,
        receiver: metadata.receiver,
        amountAfghani: metadata.amount_afghani ?? 0,
        destination: metadata.destination,
        status: owned.status,
      });
    } catch {
      setReceipt(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isInitialized, orderKey, router, userToken]);

  useEffect(() => { void loadReceipt(); }, [loadReceipt]);

  const downloadPdf = async () => {
    if (!receipt || busyAction) return;
    setBusyAction('pdf');
    try {
      const { uri } = await createRemittanceReceiptPdf(receipt);
      await Print.printAsync({ uri });
    } catch {
      showError('خطا', 'ساخت یا دریافت PDF انجام نشد.');
    } finally {
      setBusyAction(null);
    }
  };

  const shareReceipt = async () => {
    if (!receipt || busyAction) return;
    setBusyAction('share');
    try {
      if (!(await Sharing.isAvailableAsync())) {
        showError('اشتراک‌گذاری', 'اشتراک‌گذاری در این دستگاه پشتیبانی نمی‌شود.');
        return;
      }
      const { uri } = await createRemittanceReceiptPdf(receipt);
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'اشتراک‌گذاری رسید حواله' });
    } catch {
      showError('خطا', 'اشتراک‌گذاری رسید انجام نشد.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backIcon} onPress={() => router.back()} accessibilityLabel="بازگشت"><Ionicons name="arrow-forward" size={22} color="#334155" /></TouchableOpacity>
        <Text style={styles.title}>رسید حواله</Text><View style={styles.headerSpace} />
      </View>
      {loading ? (
        <View style={styles.state}><ActivityIndicator color="#0b8f72" /><Text style={styles.stateText}>در حال دریافت رسید...</Text></View>
      ) : !receipt ? (
        <View style={styles.state}><Ionicons name="document-text-outline" size={42} color="#94a3b8" /><Text style={styles.stateText}>رسید این حواله در دسترس نیست.</Text><TouchableOpacity style={styles.retry} onPress={loadReceipt}><Text style={styles.retryText}>تلاش مجدد</Text></TouchableOpacity></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <RemittanceReceiptView receipt={receipt} />
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.action, styles.primary]} onPress={downloadPdf} disabled={busyAction !== null}>
              {busyAction === 'pdf' ? <ActivityIndicator color="#fff" /> : <><Ionicons name="download-outline" size={20} color="#fff" /><Text style={styles.primaryText}>دریافت PDF</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.action, styles.secondary]} onPress={shareReceipt} disabled={busyAction !== null}>
              {busyAction === 'share' ? <ActivityIndicator color="#0b8f72" /> : <><Ionicons name="share-social-outline" size={20} color="#0b8f72" /><Text style={styles.secondaryText}>اشتراک‌گذاری رسید</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.action, styles.back]} onPress={() => router.back()} disabled={busyAction !== null}><Text style={styles.backText}>بازگشت</Text></TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f7f8' },
  header: { height: 62, paddingHorizontal: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  backIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'VazirmatnBold', fontSize: 18, color: '#17324d' }, headerSpace: { width: 42 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 36 },
  actions: { gap: 10, marginTop: 16 }, action: { minHeight: 50, borderRadius: 13, flexDirection: 'row-reverse', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#0b8f72' }, primaryText: { fontFamily: 'VazirmatnBold', fontSize: 13, color: '#fff' },
  secondary: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#99f6e4' }, secondaryText: { fontFamily: 'VazirmatnBold', fontSize: 13, color: '#0b8f72' },
  back: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }, backText: { fontFamily: 'Vazirmatn', fontSize: 13, color: '#475569' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, stateText: { fontFamily: 'Vazirmatn', color: '#64748b', marginTop: 12 },
  retry: { backgroundColor: '#0b8f72', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, marginTop: 16 }, retryText: { fontFamily: 'VazirmatnBold', color: '#fff' },
});
