import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { showError, showSuccess } from '@/lib/toast';

// تابع تبدیل اعداد به فارسی
const toPersianNum = (num: string | number) => {
  if (!num) return '۰';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

export default function AddBalanceScreen() {
  const router = useRouter();
  const { userId, userToken, isAuthenticated } = useAuth();
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'gateway' | 'card' | 'rubika'>('gateway');
  
  // استیت‌های درگاه
  const [gatewayAmount, setGatewayAmount] = useState('');
  
  // استیت‌های کارت به کارت
  const [cardAmount, setCardAmount] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [receiptImage, setReceiptImage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      if (!userId && !userToken) {
        router.replace('/login' as any);
        return;
      }

      const payload = new URLSearchParams();
      if (userId) {
        payload.append('user_id', userId);
        payload.append('id', userId);
        payload.append('uid', userId);
      }
      if (userToken) {
        payload.append('api_token', userToken);
        payload.append('token', userToken);
        payload.append('user_token', userToken);
      }

      console.log('[AddBalance] requesting dashboard.php for user_id/token:', { userId, hasToken: Boolean(userToken) });
      const data = await fetchJson<any>('dashboard.php', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });
      console.log('[AddBalance] dashboard.php parsed response:', data);
      const balanceValue = data?.balance ?? data?.user?.balance ?? data?.data?.balance ?? data?.result?.balance;
      if (balanceValue !== undefined && balanceValue !== null && balanceValue !== '') {
        setCurrentBalance(parseInt(String(balanceValue), 10));
      } else {
        console.warn('[AddBalance] balance field not found in response shape');
      }
    } catch (error) {
      console.error('خطا در دریافت موجودی:', error);
      if (error instanceof Error) {
        console.log('[AddBalance] error message:', error.message);
        console.log('[AddBalance] error cause:', error.cause);
      }
      showError('خطا', 'دریافت موجودی ناموفق بود. تنظیمات آدرس API را بررسی کنید.');
    }
  }, [router, userId, userToken]);

  // دریافت موجودی از سرور
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login' as any);
      return;
    }
    fetchBalance();
  }, [fetchBalance, isAuthenticated, router]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchBalance();
      }
    }, [fetchBalance, isAuthenticated])
  );

  // تابع کپی شماره کارت
  const copyCardNumber = async () => {
    await Clipboard.setStringAsync('6037697708447013');
    showSuccess('کپی شد', 'شماره کارت کپی شد.');
  };

  // تابع انتخاب عکس رسید
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setReceiptImage(result.assets[0]);
    }
  };

  // ارسال فرم درگاه
  const handleGatewaySubmit = async () => {
    if (!gatewayAmount) {
      showError('خطا', 'لطفا مبلغ را وارد کنید.');
      return;
    }
    showSuccess('در حال انتقال', 'انتقال به درگاه پرداخت...');
    // در صورت داشتن فایل درگاه پرداخت، لینک آن را اینجا قرار دهید
    // مثلا: Linking.openURL(`${apiUrl('pay.php')}?amount=${gatewayAmount}`);
  };

  // ارسال فرم کارت به کارت به بک‌اند
  const handleCardSubmit = async () => {
    if (!cardAmount || !trackingCode || !receiptImage) {
      showError('خطا', 'لطفا تمامی فیلدها را پر کرده و رسید را آپلود کنید.');
      return;
    }

    setIsLoading(true);

    try {
      let formData = new FormData();
      if (userId) formData.append('user_id', userId);
      if (userToken) formData.append('api_token', userToken);
      formData.append('amount', cardAmount);
      formData.append('tracking_code', trackingCode);
      
      // تنظیمات عکس برای ارسال
      let localUri = receiptImage.uri;
      let filename = localUri.split('/').pop();
      let match = /\.(\w+)$/.exec(filename);
      let type = match ? `image/${match[1]}` : `image`;
      
      formData.append('receipt', { uri: localUri, name: filename, type } as any);

      // لینک اتصال به API شما
      const data = await fetchJson<any>('add-balance.php', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      if (data?.success || data?.status === 'success' || String(data?.message || '').includes('موفق')) {
        showSuccess('موفق', 'رسید شما با موفقیت ثبت شد و در انتظار تایید است.');
        setCardAmount('');
        setTrackingCode('');
        setReceiptImage(null);
      } else {
        showError('خطا', 'خطا در ثبت رسید. لطفا دوباره تلاش کنید.');
      }
    } catch (error) {
      showError('خطا', 'مشکل در ارتباط با سرور.');
      console.error(error);
      if (error instanceof Error) {
        console.log('[AddBalance] submit error message:', error.message);
        console.log('[AddBalance] submit error cause:', error.cause);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRubikaSupport = async () => {
    const rubikaUrl = 'https://rubika.ir/Afariex2026';
    const canOpen = await Linking.canOpenURL(rubikaUrl);
    if (!canOpen) {
      showError('خطا', 'باز کردن لینک روبیکا ممکن نیست.');
      return;
    }
    await Linking.openURL(rubikaUrl);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.outerBackground}>
        <View style={styles.boxedContainer}>
          
          <View style={styles.customHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-forward" size={24} color="#4b5563" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>شارژ موجودی</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.balanceCard}>
              <Text style={styles.balanceText}>موجودی کیف پول شما:</Text>
              {currentBalance > 0 ? (
                <Text style={styles.balanceAmount}>{toPersianNum(currentBalance.toLocaleString())} تومان</Text>
              ) : (
                <Text style={styles.balanceEmpty}>کیف پول خالی می‌باشد</Text>
              )}
            </View>

            <View style={styles.tabsContainer}>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'gateway' && styles.tabBtnActive]} onPress={() => setActiveTab('gateway')}>
                <Text style={[styles.tabBtnText, activeTab === 'gateway' && styles.tabBtnTextActive]}>درگاه</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'card' && styles.tabBtnActive]} onPress={() => setActiveTab('card')}>
                <Text style={[styles.tabBtnText, activeTab === 'card' && styles.tabBtnTextActive]}>کارت به کارت</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'rubika' && styles.tabBtnActive]} onPress={() => setActiveTab('rubika')}>
                <Text style={[styles.tabBtnText, activeTab === 'rubika' && styles.tabBtnTextActive]}>روبیکا</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'gateway' && (
              <View style={styles.tabContent}>
                <TextInput style={styles.input} placeholder="مقدار شارژ (تومان)" keyboardType="numeric" value={gatewayAmount} onChangeText={setGatewayAmount} />
                <View style={styles.quickAmounts}>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setGatewayAmount('1000000')}><Text style={styles.quickBtnText}>{toPersianNum('1,000,000')}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setGatewayAmount('5000000')}><Text style={styles.quickBtnText}>{toPersianNum('5,000,000')}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setGatewayAmount('10000000')}><Text style={styles.quickBtnText}>{toPersianNum('10,000,000')}</Text></TouchableOpacity>
                </View>
                <View style={styles.spacer} />
                <TouchableOpacity style={styles.submitBtn} onPress={handleGatewaySubmit}>
                  <Text style={styles.submitBtnText}>افزایش موجودی از طریق درگاه</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'card' && (
              <View style={styles.tabContent}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>مبلغ را به شماره کارت زیر واریز کرده و رسید آن را آپلود کنید:</Text>
                  <TouchableOpacity onPress={copyCardNumber}><Text style={styles.cardNumber}>6037-6977-0844-7013</Text></TouchableOpacity>
                  <Text style={styles.cardName}>(به نام: نورآغا محمدی)</Text>
                </View>

                <TextInput style={styles.input} placeholder="مبلغ واریزی (تومان)" keyboardType="numeric" value={cardAmount} onChangeText={setCardAmount} />
                <View style={styles.quickAmounts}>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setCardAmount('100000')}><Text style={styles.quickBtnText}>{toPersianNum('100,000')}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setCardAmount('500000')}><Text style={styles.quickBtnText}>{toPersianNum('500,000')}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setCardAmount('1000000')}><Text style={styles.quickBtnText}>{toPersianNum('1,000,000')}</Text></TouchableOpacity>
                </View>

                <TextInput style={styles.input} placeholder="شماره پیگیری تراکنش" keyboardType="numeric" value={trackingCode} onChangeText={setTrackingCode} />

                <TouchableOpacity style={styles.fileUpload} onPress={pickImage}>
                  {receiptImage ? <Text style={styles.uploadTextSuccess}>رسید انتخاب شد</Text> : <Text style={styles.uploadText}>📄 آپلود عکس رسید واریز</Text>}
                </TouchableOpacity>

                <View style={styles.spacer} />

                <TouchableOpacity style={[styles.submitBtn, isLoading && { opacity: 0.7 }]} onPress={handleCardSubmit} disabled={isLoading}>
                  <Text style={styles.submitBtnText}>{isLoading ? 'در حال ارسال...' : 'ثبت فیش واریزی'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'rubika' && (
              <View style={styles.tabContent}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>برای شارژ حساب از طریق <Text style={{fontWeight: 'bold'}}>پشتیبانی</Text>، روی دکمه زیر کلیک کنید تا به روبیکای ما متصل شوید.</Text>
                  <Text style={styles.cardName}>شناسه پشتیبانی: @Afariex2026</Text>
                </View>
                <View style={styles.spacer} />
                <TouchableOpacity style={[styles.submitBtn, styles.rubikaBtn]} onPress={handleRubikaSupport}>
                  <Text style={styles.submitBtnText}>ارتباط با پشتیبانی در روبیکا</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7f9' },
  outerBackground: { flex: 1, paddingHorizontal: 15, paddingTop: 50, paddingBottom: 40 },
  boxedContainer: { flex: 1, backgroundColor: '#ffffff', borderRadius: 30, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 3 },
  customHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#2d3748', fontFamily: 'Vazirmatn' },
  scrollContent: { padding: 20, flexGrow: 1 },
  balanceCard: { alignItems: 'center', marginBottom: 20 },
  balanceText: { fontSize: 13, color: '#6b7280', marginBottom: 5, fontFamily: 'Vazirmatn' },
  balanceAmount: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', fontFamily: 'Vazirmatn' },
  balanceEmpty: { fontSize: 15, fontWeight: 'bold', color: '#ef4444', fontFamily: 'Vazirmatn' },
  tabsContainer: { flexDirection: 'row-reverse', backgroundColor: '#f4f6f8', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#0ed874' },
  tabBtnText: { fontSize: 12, color: '#6b7280', fontWeight: '500', fontFamily: 'Vazirmatn' },
  tabBtnTextActive: { color: '#ffffff', fontWeight: 'bold', fontFamily: 'Vazirmatn' },
  tabContent: { flex: 1, minHeight: 320 },
  input: { width: '100%', padding: 15, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', textAlign: 'center', fontSize: 15, marginBottom: 15, color: '#333', fontFamily: 'Vazirmatn' },
  quickAmounts: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  quickBtn: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#fff', alignItems: 'center' },
  quickBtnText: { fontSize: 12, color: '#374151', fontFamily: 'Vazirmatn' },
  spacer: { flex: 1 },
  submitBtn: { width: '100%', backgroundColor: '#0ed874', padding: 15, borderRadius: 12, alignItems: 'center', shadowColor: '#0ed874', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5, marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', fontFamily: 'Vazirmatn' },
  rubikaBtn: { backgroundColor: '#3b82f6', shadowColor: '#3b82f6' },
  infoCard: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
  infoText: { fontSize: 13, lineHeight: 22, color: '#4b5563', textAlign: 'center', marginBottom: 5, fontFamily: 'Vazirmatn' },
  cardNumber: { color: '#ef4444', fontSize: 18, letterSpacing: 2, fontWeight: 'bold', marginTop: 5, fontFamily: 'Vazirmatn' },
  cardName: { fontSize: 12, color: '#4b5563', marginTop: 5, fontFamily: 'Vazirmatn' },
  fileUpload: { borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', backgroundColor: '#f9fafb', marginBottom: 15 },
  uploadText: { color: '#6b7280', fontSize: 14, fontFamily: 'Vazirmatn' },
  uploadTextSuccess: { color: '#0ed874', fontSize: 14, fontWeight: 'bold', fontFamily: 'Vazirmatn' },
});
