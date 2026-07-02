import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { apiUrl } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { AppBottomNav } from '@/components/app-bottom-nav';

const API_BASE_URL = 'https://afariex.ir/API';

type Agency = {
  id: string | number;
  name: string;
  address?: string;
};

type ExchangeRate = {
  id: string | number;
  toman_per_afn: string | number;
  effective_date?: string;
};

const toPersianNum = (num: string | number) => {
  if (!num && num !== 0) return '۰';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

const toPersianCommaNumber = (value: number | string) => {
  const numericValue = Number(value) || 0;
  return toPersianNum(numericValue.toLocaleString('en-US'));
};

const getJalaliDate = () => {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString('fa-IR');
  }
};

export default function AddRemittanceScreen() {
  const router = useRouter();
  const { userId, userToken, userName, userMobile, setUserBalance } = useAuth();

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [selectedRateId, setSelectedRateId] = useState<number | null>(null);

  const [amountToman, setAmountToman] = useState('');
  const [amountAfghani, setAmountAfghani] = useState('');
  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string>('');
  const [resolvedApiToken, setResolvedApiToken] = useState<string>('');
  
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [lastTrackingCode, setLastTrackingCode] = useState<string>('');
  const [lastAgencyAddress, setLastAgencyAddress] = useState<string>('');
  const [lastAgencyName, setLastAgencyName] = useState<string>('');

  const selectedRate = useMemo(
    () => exchangeRates.find((rate) => Number(rate.id) === selectedRateId) || null,
    [exchangeRates, selectedRateId]
  );

  const resetForm = () => {
    setAmountToman('');
    setAmountAfghani('');
    setReceiverName('');
    setReceiverPhone('');
  };

  useEffect(() => {
    const fallbackName = userName?.trim() || userMobile?.trim() || '';
    setSenderName(fallbackName);
  }, [userName, userMobile]);

  useEffect(() => {
    const resolveAuthPayload = async () => {
      try {
        let finalUserId = userId?.trim() || '';
        let finalApiToken = userToken?.trim() || '';

        if (!finalUserId || !finalApiToken) {
          const storedUserId = await AsyncStorage.getItem('user_id') || await AsyncStorage.getItem('userId');
          const storedToken = await AsyncStorage.getItem('api_token') || await AsyncStorage.getItem('userToken');
          if (!finalUserId) finalUserId = storedUserId?.trim() || '';
          if (!finalApiToken) finalApiToken = storedToken?.trim() || '';
        }

        setResolvedUserId(finalUserId);
        setResolvedApiToken(finalApiToken);
      } catch (err) {
        console.error('Auth Resolve Error:', err);
      }
    };
    resolveAuthPayload();
  }, [userId, userToken]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agenciesResRaw, ratesResRaw] = await Promise.all([
        fetch(apiUrl('get_agencies.php')),
        fetch(apiUrl('get_exchange_rates.php')),
      ]);

      const agenciesRes = JSON.parse((await agenciesResRaw.text()) || '{}');
      const ratesRes = JSON.parse((await ratesResRaw.text()) || '{}');

      const agenciesList = agenciesRes?.data ?? agenciesRes?.rows ?? [];
      const ratesList = ratesRes?.data ?? ratesRes?.rows ?? [];

      if (agenciesRes?.success && Array.isArray(agenciesList)) {
        setAgencies(agenciesList);
        if (agenciesList.length > 0) setSelectedAgencyId(String(agenciesList[0].id));
      } else {
        setError('خطا در دریافت لیست نمایندگی‌ها');
      }

      if (ratesRes?.success && Array.isArray(ratesList)) {
        setExchangeRates(ratesList);
        if (ratesList.length > 0) setSelectedRateId(Number(ratesList[0].id));
      } else {
        setError('خطا در دریافت نرخ ارز');
      }
    } catch (err) {
      setError('خطا در ارتباط با سرور. لطفاً اینترنت خود را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!amountToman || !selectedRate) {
      setAmountAfghani('');
      return;
    }
    const rate = Number(selectedRate.toman_per_afn);
    if (!Number.isFinite(rate) || rate <= 0) {
      setAmountAfghani('');
      return;
    }
    const calculated = parseFloat(amountToman || '0') / rate;
    setAmountAfghani(Number.isFinite(calculated) ? calculated.toFixed(0) : '');
  }, [amountToman, selectedRate]);

  const handleSavePdf = async () => {
    try {
      const numericAmount = Number(amountToman || 0);
      const formattedAmount = toPersianCommaNumber(numericAmount);
      const jalaliDate = getJalaliDate();
      const destinationAddress = lastAgencyAddress || 'آدرس ثبت نشده';

      const html = `
      <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8" />
          <style>
            body { direction: rtl; font-family: Tahoma, Arial, sans-serif; color: #0f172a; padding: 20px; }
            .card { border: 2px solid #0ed874; border-radius: 16px; padding: 20px; text-align: right; }
            .brand { text-align: center; font-size: 24px; font-weight: bold; color: #0ed874; margin-bottom: 10px; }
            .title { text-align: center; font-size: 18px; margin-bottom: 20px; }
            .line { font-size: 16px; margin: 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .amount { font-weight: bold; color: #0ed874; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">صرافی آفارایکس</div>
            <div class="title">✅ رسید ثبت حواله - کد: ${toPersianNum(lastTrackingCode)}</div>
            <div class="line">تاریخ: ${jalaliDate}</div>
            <div class="line">فرستنده: ${senderName || '-'}</div>
            <div class="line">گیرنده: ${receiverName || '-'}</div>
            <div class="line">مبلغ: <span class="amount">${formattedAmount} تومان</span></div>
            <div class="line">مقصد: ${destinationAddress}</div>
          </div>
        </body>
      </html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        showSuccess('PDF آماده شد', uri);
      }
    } catch (err) {
      showError('خطا', 'ساخت PDF ناموفق بود.');
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const selectedAgency = agencies.find((a) => String(a.id) === String(selectedAgencyId));
    
    if (!selectedAgency) return showError('خطا', 'لطفاً یک نمایندگی انتخاب کنید.');
    if (!selectedRate) return showError('خطا', 'نرخ ارز معتبر یافت نشد.');
    if (!amountToman || Number(amountToman) <= 0) return showError('خطا', 'مبلغ تومان را وارد کنید.');
    if (!resolvedUserId) return showError('خطا', 'شناسه کاربر یافت نشد. دوباره وارد شوید.');
    if (!senderName.trim() || !receiverName.trim() || !receiverPhone.trim()) {
      return showError('خطا', 'نام فرستنده، گیرنده و شماره تماس الزامی است.');
    }

    setSubmitting(true);
    try {
      // استفاده از URLSearchParams برای اطمینان 100% از دریافت در بک‌اند
      const payload = new URLSearchParams();
      
      // کلیدهای زیر دقیقاً با فایل بک‌اند همگام شده‌اند
      payload.append('user_id', resolvedUserId);
      payload.append('agency', selectedAgency.name);
      payload.append('sender', senderName.trim());
      payload.append('receiver', receiverName.trim());
      payload.append('amount_toman', amountToman.trim());
      payload.append('amount_afghani', amountAfghani.trim());

      const response = await fetch(`${API_BASE_URL}/add_remittance.php`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });

      const responseText = await response.text();
      let result: any = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error('Ù¾Ø§Ø³Ø® Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø² Ø³Ø±ÙˆØ±.');
      }

      const responseMessage = typeof result?.message === 'string' ? result.message.trim() : '';
      const normalizedStatus = String(result?.status ?? '').toLowerCase();
      const isErrorResponse = normalizedStatus === 'error' || response.status === 403 || !response.ok;

      if (isErrorResponse) {
        showError('Ø®Ø·Ø§', responseMessage || 'Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª Ø­ÙˆØ§Ù„Ù‡.');
        return;
      }

      if (result?.status === 'success' || result?.success) {
        setLastTrackingCode(result?.data?.tracking_number || `TMP-${Date.now().toString().slice(-6)}`);
        setLastAgencyAddress(selectedAgency?.address || 'آدرس ثبت نشده');
        setLastAgencyName(selectedAgency?.name || '');
        const newBalance =
          result?.new_balance ??
          result?.data?.new_balance ??
          result?.result?.new_balance ??
          result?.balance ??
          result?.data?.balance ??
          result?.result?.balance ??
          null;

        const nextBalance = newBalance !== null && newBalance !== '' ? Number(newBalance) : null;
        if (Number.isFinite(nextBalance)) {
          setUserBalance(nextBalance);
        }
        
        setSuccessModalVisible(true);
        showSuccess('موفق', 'حواله با موفقیت ثبت شد.');
      } else {
        showError('خطا', result?.message || 'خطا در ثبت حواله.');
      }
    } catch (err) {
      showError('خطای ارتباط', 'مشکل در ارتباط با سرور رخ داده است.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0ed874" />
        <Text style={styles.loadingText}>در حال دریافت اطلاعات...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>تلاش مجدد</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.outerBackground}>
          <View style={styles.boxedContainer}>
            
            {/* هدر مشابه صفحه افزایش موجودی */}
            <View style={styles.customHeader}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-forward" size={24} color="#4b5563" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>ثبت حواله جدید</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              
              <Text style={styles.label}>نمایندگی مقصد</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedAgencyId ?? ''}
                  onValueChange={(v) => setSelectedAgencyId(String(v))}>
                  {agencies.map((agency) => (
                    <Picker.Item key={agency.id} label={agency.name} value={String(agency.id)} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>نرخ ارز امروز</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyText}>
                  {selectedRate ? `${toPersianNum(selectedRate.toman_per_afn)} تومان به ازای هر افغانی` : '-'}
                </Text>
              </View>

              <Text style={styles.label}>نام فرستنده</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                editable={false}
                value={senderName}
                placeholder="نام شما"
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>مبلغ (تومان)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={amountToman}
                    onChangeText={setAmountToman}
                    placeholder="مثال: 5000000"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>معادل (افغانی)</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    editable={false}
                    value={amountAfghani ? toPersianNum(amountAfghani) : ''}
                    placeholder="۰"
                  />
                </View>
              </View>

              <Text style={styles.label}>نام گیرنده</Text>
              <TextInput
                style={styles.input}
                value={receiverName}
                onChangeText={setReceiverName}
                placeholder="نام کامل گیرنده حواله"
              />

              <Text style={styles.label}>شماره تماس گیرنده</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={receiverPhone}
                onChangeText={setReceiverPhone}
                placeholder="شماره موبایل گیرنده"
              />

              <View style={styles.spacer} />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.disabledBtn]}
                onPress={handleSubmit}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>ثبت و ارسال حواله</Text>
                )}
              </TouchableOpacity>

            </ScrollView>
          </View>
          <AppBottomNav />
        </View>
      </KeyboardAvoidingView>

      {/* مدال موفقیت */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle" size={60} color="#0ed874" style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={styles.modalTitle}>حواله با موفقیت ثبت شد</Text>
            <Text style={styles.modalLine}>کد پیگیری: <Text style={styles.modalCode}>{toPersianNum(lastTrackingCode)}</Text></Text>
            <Text style={styles.modalLine}>نمایندگی: {lastAgencyName}</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.pdfBtn]} onPress={handleSavePdf}>
                <Ionicons name="document-text-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
                <Text style={styles.modalBtnText}>ذخیره رسید PDF</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalBtn, styles.homeBtn]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  resetForm();
                  router.replace('/dashboard');
                }}>
                <Text style={styles.modalBtnText}>بازگشت به پیشخوان</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  outerBackground: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 70 },
  boxedContainer: { 
    flex: 1, 
    backgroundColor: '#ffffff', 
    overflow: 'hidden', 
    shadowOpacity: 0, 
    shadowRadius: 0, 
    elevation: 0 
  },
  customHeader: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f4f6' 
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#2d3748', fontFamily: 'Vazirmatn' },
  scrollContent: { padding: 0, flexGrow: 1, paddingBottom: 70 },
  
  label: { fontSize: 13, color: '#6b7280', marginBottom: 8, marginTop: 15, fontFamily: 'Vazirmatn', textAlign: 'right' },
  input: { 
    width: '100%', 
    padding: 15, 
    borderWidth: 1, 
    borderColor: '#e5e7eb', 
    borderRadius: 12, 
    backgroundColor: '#f9fafb', 
    textAlign: 'right', 
    fontSize: 14, 
    color: '#333', 
    fontFamily: 'Vazirmatn' 
  },
  disabledInput: { backgroundColor: '#f3f4f6', color: '#9ca3af' },
  
  pickerContainer: { 
    borderWidth: 1, 
    borderColor: '#e5e7eb', 
    borderRadius: 12, 
    backgroundColor: '#f9fafb', 
    overflow: 'hidden' 
  },
  readonlyBox: { 
    borderWidth: 1, 
    borderColor: '#e5e7eb', 
    borderRadius: 12, 
    padding: 15, 
    backgroundColor: '#f3f4f6' 
  },
  readonlyText: { fontSize: 14, color: '#4b5563', fontFamily: 'Vazirmatn', textAlign: 'right' },
  
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  half: { flex: 1 },
  spacer: { marginTop: 25 },
  
  submitBtn: { 
    width: '100%', 
    backgroundColor: '#0ed874', 
    padding: 15, 
    borderRadius: 12, 
    alignItems: 'center', 
    shadowColor: '#0ed874', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 10, 
    elevation: 5, 
    marginTop: 10,
    marginBottom: 20 
  },
  disabledBtn: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', fontFamily: 'Vazirmatn' },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  loadingText: { marginTop: 10, color: '#6b7280', fontFamily: 'Vazirmatn' },
  errorText: { color: '#ef4444', fontFamily: 'Vazirmatn', marginBottom: 15, textAlign: 'center' },
  retryBtn: { backgroundColor: '#0ed874', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontFamily: 'Vazirmatn' },

  // استایل‌های مدال
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 25, width: '100%' },
  modalTitle: { textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#1f2937', fontFamily: 'Vazirmatn', marginBottom: 15 },
  modalLine: { textAlign: 'center', fontSize: 14, color: '#4b5563', fontFamily: 'Vazirmatn', marginBottom: 8 },
  modalCode: { fontWeight: 'bold', color: '#0ed874', fontSize: 16 },
  modalActions: { marginTop: 20, gap: 10 },
  modalBtn: { flexDirection: 'row-reverse', borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' },
  pdfBtn: { backgroundColor: '#0ed874' },
  homeBtn: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold', fontFamily: 'Vazirmatn' },
});

