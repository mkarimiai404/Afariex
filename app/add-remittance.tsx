import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { showError, showSuccess } from '@/lib/toast';

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

type AgenciesResponse = {
  success: boolean;
  data?: Agency[];
  rows?: Agency[];
  message?: string;
};

type ExchangeRatesResponse = {
  success: boolean;
  data?: ExchangeRate[];
  rows?: ExchangeRate[];
  message?: string;
};

type AddRemittanceResponse = {
  success?: boolean;
  message?: string;
  data?: {
    remittance_id?: number | string;
    tracking_number?: number | string;
    code?: number | string;
    agency_address?: string;
    agency_name?: string;
  };
};

const persianUnits = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const persianTeens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const persianTens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const persianHundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const persianScales = ['', 'هزار', 'میلیون', 'میلیارد'];

const toPersianWords = (value: number) => {
  const num = Math.floor(Math.abs(value));
  if (num === 0) return 'صفر';

  const convertChunk = (chunk: number) => {
    const parts: string[] = [];
    const hundreds = Math.floor(chunk / 100);
    const tensUnits = chunk % 100;

    if (hundreds) parts.push(persianHundreds[hundreds]);
    if (tensUnits >= 10 && tensUnits < 20) {
      parts.push(persianTeens[tensUnits - 10]);
    } else {
      const tens = Math.floor(tensUnits / 10);
      const units = tensUnits % 10;
      if (tens) parts.push(persianTens[tens]);
      if (units) parts.push(persianUnits[units]);
    }

    return parts.filter(Boolean).join(' و ');
  };

  const chunks: string[] = [];
  let remaining = num;
  let scaleIndex = 0;

  while (remaining > 0 && scaleIndex < persianScales.length) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const chunkWords = convertChunk(chunk);
      chunks.unshift([chunkWords, persianScales[scaleIndex]].filter(Boolean).join(' '));
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  return chunks.filter(Boolean).join(' و ');
};

const toPersianCommaNumber = (value: number | string) => {
  const numericValue = Number(value) || 0;
  return numericValue.toLocaleString('en-US');
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
  const { userId, userToken, userName, userMobile } = useAuth();

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
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
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [lastTrackingCode, setLastTrackingCode] = useState<string>('');
  const [lastAgencyAddress, setLastAgencyAddress] = useState<string>('');
  const [lastAgencyName, setLastAgencyName] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingWalletBalance, setLoadingWalletBalance] = useState(false);

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

  const buildTrackingCode = (apiResult: AddRemittanceResponse) => {
    const fromApi =
      apiResult?.data?.tracking_number ??
      apiResult?.data?.code ??
      apiResult?.data?.remittance_id;
    if (fromApi !== undefined && fromApi !== null && String(fromApi).trim() !== '') {
      return String(fromApi);
    }
    return `TMP-${Date.now().toString().slice(-8)}`;
  };

  const fetchWalletBalance = async (currentUserId: string, currentToken: string) => {
    if (!currentUserId || !currentToken) {
      setWalletBalance(null);
      return;
    }

    setLoadingWalletBalance(true);
    try {
      const payload = new URLSearchParams();
      payload.append('user_id', currentUserId);
      payload.append('id', currentUserId);
      payload.append('uid', currentUserId);
      payload.append('api_token', currentToken);
      payload.append('token', currentToken);
      payload.append('user_token', currentToken);

      const response = await fetch(`${API_BASE_URL}/dashboard.php`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });

      const data = await response.json();
      const balanceValue = data?.balance ?? data?.user?.balance ?? data?.data?.balance ?? data?.result?.balance;

      if (balanceValue !== undefined && balanceValue !== null && balanceValue !== '') {
        const parsedBalance = Number(balanceValue);
        setWalletBalance(Number.isFinite(parsedBalance) ? parsedBalance : 0);
      } else {
        setWalletBalance(0);
      }
    } catch (err) {
      console.error('API Error Details:', err);
      setWalletBalance(0);
    } finally {
      setLoadingWalletBalance(false);
    }
  };

  const handleSavePdf = async () => {
    try {
      const numericAmount = Number(amountToman || 0);
      const formattedAmount = toPersianCommaNumber(numericAmount);
      const amountInWords = toPersianWords(numericAmount);
      const jalaliDate = getJalaliDate();
      const destinationAddress = lastAgencyAddress || 'آدرس ثبت نشده';
      const statusInPersian = 'در حال پردازش / آماده پرداخت';

      const html = `
      <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              margin: 0;
              padding: 0;
              direction: rtl;
              font-family: Tahoma, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
            }
            .page {
              max-width: 720px;
              margin: 0 auto;
              padding: 28px 22px;
            }
            .card {
              border: 1px solid #d6f5e6;
              border-radius: 16px;
              padding: 24px 20px;
              box-shadow: 0 8px 24px rgba(15, 159, 88, 0.08);
            }
            .brand {
              text-align: center;
              font-size: 22px;
              font-weight: 900;
              color: #0f9f58;
              margin-bottom: 10px;
            }
            .title {
              text-align: center;
              font-size: 18px;
              font-weight: 900;
              color: #111827;
              margin-bottom: 22px;
            }
            .line {
              font-size: 15px;
              line-height: 2.1;
              margin: 6px 0;
              text-align: right;
            }
            .label {
              font-weight: 900;
              color: #111827;
            }
            .value {
              font-weight: 700;
              color: #1f2937;
            }
            .amount {
              font-weight: 900;
              color: #0f9f58;
            }
            .note {
              margin-top: 20px;
              padding-top: 16px;
              border-top: 1px dashed #d1fae5;
              font-size: 14px;
              line-height: 2;
              color: #374151;
              text-align: center;
            }
            .footer {
              margin-top: 18px;
              text-align: center;
              font-size: 13px;
              color: #6b7280;
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="card">
              <div class="brand">صرافی آفارایکس</div>
              <div class="title">✅ تاییدیه شماره حواله ${lastTrackingCode}</div>

              <div class="line"><span class="label">📅 تاریخ:</span> <span class="value">${jalaliDate}</span></div>
              <div class="line"><span class="label">👤 فرستنده:</span> <span class="value">${senderName || '-'}</span></div>
              <div class="line"><span class="label">👤 گیرنده:</span> <span class="value">${receiverName || '-'}</span></div>
              <div class="line">
                <span class="label">💰 مبلغ:</span>
                <span class="amount">${formattedAmount}</span>
                <span class="value">«${amountInWords}»</span>
                <span class="value">تومان</span>
              </div>
              <div class="line"><span class="label">📍 مقصد:</span> <span class="value">${destinationAddress}</span></div>
              <div class="line"><span class="label">وضعیت:</span> <span class="value">${statusInPersian}</span></div>

              <div class="note">
                مشتری گرامی، حواله شما با موفقیت ثبت شد. لطفا هنگام دریافت وجه، اصل تذکره یا کارت شناسایی معتبر به همراه داشته باشید.
              </div>

              <div class="footer">AfaraX Exchange</div>
            </div>
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
      console.error('API Error Details:', err);
      showError('خطا', 'ساخت PDF ناموفق بود.');
    }
  };

  useEffect(() => {
    const fallbackName = userName?.trim() || userMobile?.trim() || '';
    setSenderName(fallbackName);
  }, [userName, userMobile]);

  useEffect(() => {
    const resolveAuthPayload = async () => {
      setLoadingAuth(true);
      try {
        const resolvedIdFromContext = userId?.trim() || '';
        const resolvedTokenFromContext = userToken?.trim() || '';

        let finalUserId = resolvedIdFromContext;
        let finalApiToken = resolvedTokenFromContext;

        if (!finalUserId || !finalApiToken) {
          const [
            storedUserIdA,
            storedUserIdB,
            storedTokenA,
            storedTokenB,
            storedTokenC,
          ] = await Promise.all([
            AsyncStorage.getItem('userId'),
            AsyncStorage.getItem('user_id'),
            AsyncStorage.getItem('userToken'),
            AsyncStorage.getItem('api_token'),
            AsyncStorage.getItem('token'),
          ]);

          if (!finalUserId) finalUserId = (storedUserIdA || storedUserIdB || '').trim();
          if (!finalApiToken) finalApiToken = (storedTokenA || storedTokenB || storedTokenC || '').trim();
        }

        setResolvedUserId(finalUserId);
        setResolvedApiToken(finalApiToken);

        if (finalUserId && finalApiToken) {
          await fetchWalletBalance(finalUserId, finalApiToken);
        } else {
          setWalletBalance(null);
        }
      } catch (err) {
        console.error('API Error Details:', err);
        setResolvedUserId('');
        setResolvedApiToken('');
        setWalletBalance(null);
      } finally {
        setLoadingAuth(false);
      }
    };

    resolveAuthPayload();
  }, [userId, userToken]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agenciesResRaw, ratesResRaw] = await Promise.all([
        fetch(`${API_BASE_URL}/get_agencies.php`),
        fetch(`${API_BASE_URL}/get_exchange_rates.php`),
      ]);

      const agenciesRes: AgenciesResponse = await agenciesResRaw.json();
      const ratesRes: ExchangeRatesResponse = await ratesResRaw.json();

      const agenciesList = agenciesRes?.data ?? agenciesRes?.rows ?? [];
      const ratesList = ratesRes?.data ?? ratesRes?.rows ?? [];

      if (agenciesRes?.success && Array.isArray(agenciesList)) {
        setAgencies(agenciesList);
        if (agenciesList.length > 0) {
          setSelectedAgencyId(Number(agenciesList[0].id));
        }
      } else {
        setError(agenciesRes?.message || 'خطا در دریافت لیست نمایندگی‌ها');
        setAgencies([]);
      }

      if (ratesRes?.success && Array.isArray(ratesList)) {
        setExchangeRates(ratesList);
        if (ratesList.length > 0) {
          setSelectedRateId(Number(ratesList[0].id));
        }
      } else {
        setError(ratesRes?.message || 'خطا در دریافت نرخ ارز');
        setExchangeRates([]);
      }
    } catch (err) {
      console.error('API Error Details:', err);
      setError('خطا در ارتباط با سرور. لطفاً اینترنت خود را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (resolvedUserId && resolvedApiToken) {
      void fetchWalletBalance(resolvedUserId, resolvedApiToken);
    }
  }, [resolvedUserId, resolvedApiToken]);

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

  const handleSubmit = async () => {
    if (submitting) return;

    const selectedAgency = agencies.find((a) => Number(a.id) === selectedAgencyId);
    const selectedRateObj = exchangeRates.find((r) => Number(r.id) === selectedRateId);

    if (!selectedAgencyId || !selectedAgency) {
      showError('خطا', 'لطفاً یک نمایندگی انتخاب کنید.');
      return;
    }
    if (!selectedRateId || !selectedRateObj) {
      showError('خطا', 'نرخ ارز معتبر یافت نشد.');
      return;
    }
    if (!amountToman || Number(amountToman) <= 0) {
      showError('خطا', 'مبلغ تومان را به‌درستی وارد کنید.');
      return;
    }
    if (!amountAfghani || Number(amountAfghani) <= 0) {
      showError('خطا', 'مبلغ افغانی معتبر نیست.');
      return;
    }
    if (!resolvedUserId) {
      showError('خطا', 'شناسه کاربر (user_id) یافت نشد. لطفاً دوباره وارد شوید.');
      return;
    }
    if (!resolvedApiToken) {
      showError('خطا', 'توکن کاربر (api_token) یافت نشد. لطفاً دوباره وارد شوید.');
      return;
    }
    if (!senderName.trim() || !receiverName.trim() || !receiverPhone.trim()) {
      showError('خطا', 'نام فرستنده، گیرنده و شماره تماس الزامی است.');
      return;
    }
    if (loadingWalletBalance) {
      showError('خطا', 'در حال دریافت موجودی کیف پول هستیم. لطفاً چند لحظه دیگر تلاش کنید.');
      return;
    }
    if (walletBalance === null) {
      await fetchWalletBalance(resolvedUserId, resolvedApiToken);
      const latestBalance = walletBalance ?? 0;
      if (latestBalance === null || latestBalance <= 0) {
        showError('خطا', 'ابتدا موجودی کیف پول خود را شارژ کنید.');
        return;
      }
    }
    if ((walletBalance ?? 0) <= 0) {
      showError('خطا', 'ابتدا موجودی کیف پول خود را شارژ کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id: resolvedUserId,
        api_token: resolvedApiToken,
        agency_id: selectedAgencyId,
        amount_toman: amountToman.trim(),
        amount_afn: amountAfghani.trim(),
        sender_name: senderName.trim(),
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        agency: selectedAgency.name,
        rate: String(selectedRateObj.toman_per_afn),
      };

      const response = await fetch(`${API_BASE_URL}/add_remittance.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result: AddRemittanceResponse = await response.json();

      if (result?.success) {
        const trackingCode = buildTrackingCode(result);
        const agencyAddressFromApi = result?.data?.agency_address || '';
        const selectedAgencyAddress = selectedAgency?.address || '';
        const finalAddress = agencyAddressFromApi || selectedAgencyAddress || 'آدرس ثبت نشده';
        const finalAgencyName = result?.data?.agency_name || selectedAgency?.name || '';

        setLastTrackingCode(trackingCode);
        setLastAgencyAddress(finalAddress);
        setLastAgencyName(finalAgencyName);
        setSuccessModalVisible(true);
        showSuccess('موفق', 'حواله با موفقیت ثبت شد.');
      } else {
        showError('خطا', result?.message || 'خطا در ثبت حواله');
      }
    } catch (err) {
      console.error('API Error Details:', err);
      showError('خطای ارتباط', 'مشکل در ارتباط با سرور رخ داده است.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingAuth) {
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.title}>ثبت حواله</Text>

        <Text style={styles.label}>نمایندگی</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={selectedAgencyId} onValueChange={(v) => setSelectedAgencyId(v)}>
            {agencies.map((agency) => (
              <Picker.Item key={agency.id} label={agency.name} value={Number(agency.id)} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>نرخ ارز</Text>
        <View style={styles.readonlyBox}>
          <Text style={styles.readonlyText}>
            {selectedRate ? `${selectedRate.toman_per_afn} تومان به ازای هر افغانی` : '-'}
          </Text>
        </View>

        <Text style={styles.label}>نام فرستنده</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          editable={false}
          value={senderName}
          placeholder="نام کاربر"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>مبلغ تومان</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amountToman}
              onChangeText={setAmountToman}
              placeholder="5000000"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>مبلغ افغانی</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              editable={false}
              value={amountAfghani}
              placeholder="0"
            />
          </View>
        </View>

        <Text style={styles.label}>نام گیرنده</Text>
        <TextInput
          style={styles.input}
          value={receiverName}
          onChangeText={setReceiverName}
          placeholder="نام گیرنده"
        />

        <Text style={styles.label}>شماره تماس گیرنده</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={receiverPhone}
          onChangeText={setReceiverPhone}
          placeholder="09xxxxxxxxx"
        />

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !resolvedUserId || !resolvedApiToken) && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={submitting || !resolvedUserId || !resolvedApiToken}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>ثبت حواله</Text>}
        </TouchableOpacity>
      </View>

      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ثبت حواله با موفقیت انجام شد</Text>
            <Text style={styles.modalLine}>کد حواله: <Text style={styles.modalCode}>{lastTrackingCode}</Text></Text>
            <Text style={styles.modalLine}>نمایندگی: {lastAgencyName || '-'}</Text>
            <Text style={styles.modalLine}>آدرس نمایندگی: {lastAgencyAddress || '-'}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.pdfBtn]} onPress={handleSavePdf}>
                <Text style={styles.modalBtnText}>ذخیره PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.homeBtn]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  resetForm();
                  router.replace('/dashboard');
                }}>
                <Text style={styles.modalBtnText}>رفتن به خانه</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.closeBtn]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  resetForm();
                }}>
                <Text style={styles.modalBtnText}>بستن</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f5',
    justifyContent: 'center',
  },
  container: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#e4e8ec',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f7f5',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'VazirmatnBold',
    textAlign: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
    marginTop: 8,
    fontFamily: 'Vazirmatn',
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7dde3',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#fdfefe',
    color: '#111827',
    fontFamily: 'Vazirmatn',
    fontSize: 14,
    textAlign: 'right',
  },
  readonlyBox: {
    borderWidth: 1,
    borderColor: '#d7dde3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8faf9',
  },
  readonlyText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Vazirmatn',
    textAlign: 'right',
    fontWeight: '500',
  },
  disabledInput: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d7dde3',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
  },
  half: {
    flex: 1,
  },
  submitBtn: {
    backgroundColor: '#0ed874',
    marginTop: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    shadowColor: '#0ed874',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 3,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'VazirmatnBold',
    fontWeight: '700',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontFamily: 'Vazirmatn',
    textAlign: 'center',
    marginBottom: 14,
  },
  retryBtn: {
    backgroundColor: '#0ed874',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'VazirmatnBold',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 8,
    color: '#4b5563',
    fontSize: 14,
    fontFamily: 'Vazirmatn',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d6f5e6',
    padding: 18,
  },
  modalTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0f9f58',
    fontFamily: 'VazirmatnBold',
    marginBottom: 10,
  },
  modalLine: {
    textAlign: 'right',
    fontSize: 14,
    color: '#1f2937',
    fontFamily: 'Vazirmatn',
    marginBottom: 6,
    lineHeight: 22,
  },
  modalCode: {
    fontWeight: '700',
    color: '#0f9f58',
    fontFamily: 'VazirmatnBold',
  },
  modalActions: {
    marginTop: 10,
    gap: 8,
  },
  modalBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'VazirmatnBold',
    fontWeight: '700',
  },
  pdfBtn: {
    backgroundColor: '#0ed874',
  },
  homeBtn: {
    backgroundColor: '#059669',
  },
  closeBtn: {
    backgroundColor: '#6b7280',
  },
});
