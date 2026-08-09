import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { showError, showSuccess } from '@/lib/toast';

const INITIAL_LIMIT = 5000000;

export default function WithdrawScreen() {
  const router = useRouter();
  const { userId, userToken } = useAuth();
  const [amount, setAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [limit, setLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `withdraw-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`);

  useEffect(() => {
    if (!userId || !userToken) return;
    const body = new URLSearchParams({ user_id: userId, api_token: userToken });
    fetch(apiUrl('dashboard.php'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
      .then((response) => response.json())
      .then((data) => setLimit(data?.verification?.withdrawal_limit ?? data?.user?.verification?.withdrawal_limit ?? INITIAL_LIMIT))
      .catch(() => setLimit(INITIAL_LIMIT));
  }, [userId, userToken]);

  const openUpgradePrompt = (details?: any) => Alert.alert(
    'محدودیت برداشت',
    'سقف برداشت سطح فعلی شما ۵,۰۰۰,۰۰۰ تومان است. برای برداشت بیشتر، سطح کاربری خود را ارتقاء دهید.',
    [
      { text: 'انصراف', style: 'cancel' },
      { text: 'ارتقاء سطح کاربری', onPress: () => router.push('/access-level' as any) },
    ]
  );

  const submit = async () => {
    const value = Number(amount.replace(/,/g, '').trim());
    if (!Number.isFinite(value) || value <= 0) {
      showError('خطا', 'لطفاً مبلغ معتبر و بیشتر از صفر وارد کنید.');
      return;
    }
    const normalizedCard = cardNumber.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[\s-]/g, '');
    if (!/^\d{16}$/.test(normalizedCard)) {
      showError('شماره کارت نامعتبر', 'شماره کارت بانکی ۱۶ رقمی را وارد کنید.');
      return;
    }
    if (cardholderName.trim().length < 3) {
      showError('نام صاحب کارت نامعتبر', 'نام و نام خانوادگی صاحب کارت را وارد کنید.');
      return;
    }
    if (!userToken || loading) return;
    setLoading(true);
    try {
      const body = new URLSearchParams({
        api_token: userToken,
        amount: String(value),
        card_number: normalizedCard,
        cardholder_name: cardholderName.trim(),
        idempotency_key: idempotencyKey,
      });
      const response = await fetch(apiUrl('withdraw.php'), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      const data = await response.json();
      if (data?.code === 'DAILY_TRANSACTION_LIMIT_EXCEEDED' || data?.code === 'WITHDRAWAL_LIMIT_EXCEEDED') {
        const details = data?.data || {};
        showError('سقف تراکنش روزانه', `سقف: ${Number(details.daily_limit || 0).toLocaleString('en-US')} تومان، مصرف امروز: ${Number(details.used_today || 0).toLocaleString('en-US')} تومان، باقی‌مانده: ${Number(details.remaining_today || 0).toLocaleString('en-US')} تومان`);
        openUpgradePrompt(data?.data);
      } else if (!response.ok || data?.success !== true) {
        showError('خطا', data?.message || 'ثبت برداشت انجام نشد.');
      } else {
        showSuccess('موفق', data.message || 'برداشت با موفقیت ثبت شد.');
        setAmount('');
        setCardNumber('');
        setCardholderName('');
        setIdempotencyKey(`withdraw-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`);
      }
    } catch {
      showError('خطا', 'ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-forward" size={22} color="#374151" /></TouchableOpacity>
          <Text style={styles.title}>برداشت وجه</Text><View style={styles.headerSpace} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>مبلغ برداشت (تومان)</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="مبلغ را وارد کنید" textAlign="right" />
            <Text style={styles.labelWithSpacing}>شماره کارت</Text>
            <TextInput style={styles.input} value={cardNumber} onChangeText={setCardNumber} keyboardType="numeric" maxLength={22} placeholder="شماره کارت ۱۶ رقمی" textAlign="right" />
            <Text style={styles.labelWithSpacing}>نام و نام خانوادگی صاحب کارت</Text>
            <TextInput style={styles.input} value={cardholderName} onChangeText={setCardholderName} maxLength={150} placeholder="نام کامل صاحب کارت" textAlign="right" />
            <Text style={styles.limitText}>سقف برداشت سطح فعلی: {limit === null ? 'بدون محدودیت اولیه' : `${limit.toLocaleString('en-US')} تومان`}</Text>
            <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ثبت برداشت</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 18 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'VazirmatnBold', fontSize: 18, color: '#1f2937' },
  headerSpace: { width: 40 },
  content: { paddingBottom: 30 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  label: { fontFamily: 'Vazirmatn', color: '#4b5563', textAlign: 'right', marginBottom: 8 },
  labelWithSpacing: { fontFamily: 'Vazirmatn', color: '#4b5563', textAlign: 'right', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontFamily: 'Vazirmatn', fontSize: 16, color: '#111827' },
  limitText: { fontFamily: 'Vazirmatn', fontSize: 12, color: '#6b7280', textAlign: 'right', marginTop: 12 },
  button: { backgroundColor: '#0ed874', borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  disabled: { opacity: 0.65 },
  buttonText: { fontFamily: 'VazirmatnBold', color: '#fff' },
});
